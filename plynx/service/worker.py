import argparse
import logging
import socket
import uuid
import threading
import traceback
from tempfile import SpooledTemporaryFile
from . import WorkerMessage, WorkerMessageType, RunStatus, MasterMessageType, send_msg, recv_msg
from plynx.constants import JobReturnStatus
from plynx.utils.file_handler import upload_file_stream
from plynx.utils.logs import set_logging_level


DEFAULT_HOST, DEFAULT_PORT = "127.0.0.1", 10000


class RunningPipelineException(Exception):
    """Internal Exception which indicates incorrect state of the Worker."""
    pass


class Worker:
    """Worker main class.

    Worker is a service that executes the commands defined by Operations.

    Args:
        worker_id   (str):  An arbitary ID of the worker. It must be unique accross the cluster.
                            If not given or empty, a unique ID will be generated.
        host        (str):  Host of the Master.
        port        (int):  Port of the Master.

    Worker is running in several threads:
        * Main thread: heartbeat iterations.
        * _run_worker thread. It executes the jobs and handles states.

    """

    HEARTBEAT_TIMEOUT = 1
    RUNNER_TIMEOUT = 1
    NUMBER_OF_ATTEMPTS = 10

    def __init__(self, worker_id, host, port):
        if not worker_id:
            worker_id = str(uuid.uuid1())
        self._stop_event = threading.Event()
        self._job = None
        self._graph_id = None
        self._worker_id = worker_id
        self._host = host
        self._port = port
        self._job_killed = False
        self._set_run_status(RunStatus.IDLE)

    def serve_forever(self, number_of_attempts=NUMBER_OF_ATTEMPTS):
        """Run the worker.
        Args:
            number_of_attempts  (int): Number of retries if the connection is not established.
        """
        self._run_thread = threading.Thread(target=self._run_worker, args=())
        self._run_thread.daemon = True   # Daemonize thread
        self._run_thread.start()

        # run _heartbeat_iteration()
        attempt = 0
        while not self._stop_event.is_set():
            try:
                self._heartbeat_iteration()
                if attempt > 0:
                    logging.info("Connected")
                attempt = 0
            except socket.error:
                logging.warn("Failed to connect: #{}/{}".format(attempt + 1, number_of_attempts))
                attempt += 1
                if attempt == number_of_attempts:
                    self.stop()
                    raise
            self._stop_event.wait(timeout=Worker.HEARTBEAT_TIMEOUT)

    def _heartbeat_iteration(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            # Connect to server and send data
            sock.connect((self._host, self._port))
            message = WorkerMessage(
                worker_id=self._worker_id,
                run_status=self._run_status,
                message_type=WorkerMessageType.HEARTBEAT,
                body=self._job if self._run_status != RunStatus.IDLE else None,
                graph_id=self._graph_id
            )
            send_msg(sock, message)
            master_message = recv_msg(sock)
            # check status
            if master_message.message_type == MasterMessageType.KILL:
                logging.info("Received KILL message: {}".format(master_message))
                if self._job and not self._job_killed:
                    self._job_killed = True
                    self._job.kill()
                else:
                    logging.info("Already attempted to KILL")
        finally:
            sock.close()

    def _run_worker(self):
        while not self._stop_event.is_set():
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                try:
                    if self._run_status == RunStatus.IDLE:
                        sock.connect((self._host, self._port))
                        message = WorkerMessage(
                            worker_id=self._worker_id,
                            run_status=self._run_status,
                            message_type=WorkerMessageType.GET_JOB,
                            body=None,
                            graph_id=None
                        )
                        send_msg(sock, message)
                        master_message = recv_msg(sock)
                        logging.debug("Asked for a job; Received mesage: {}".format(master_message))
                        if master_message and master_message.message_type == MasterMessageType.SET_JOB:
                            logging.info(
                                "Got the job: graph_id=`{graph_id}` job_id=`{job_id}`".format(
                                    graph_id=master_message.graph_id,
                                    job_id=master_message.job.node._id,
                                )
                            )
                            self._job_killed = False
                            self._set_run_status(RunStatus.RUNNING)
                            self._job = master_message.job
                            self._graph_id = master_message.graph_id
                            try:
                                status = self._job.run()
                            except Exception as e:
                                try:
                                    status = JobReturnStatus.FAILED
                                    with SpooledTemporaryFile() as f:
                                        f.write(traceback.format_exc())
                                        self._job.node.get_log_by_name('worker').resource_id = upload_file_stream(f)
                                except Exception as e:
                                    logging.critical(traceback.format_exc())
                                    self.stop()

                            self._job_killed = True
                            if status == JobReturnStatus.SUCCESS:
                                self._set_run_status(RunStatus.SUCCESS)
                            elif status == JobReturnStatus.FAILED:
                                self._set_run_status(RunStatus.FAILED)
                            logging.info(
                                "Worker(`{worker_id}`) finished with status {status}".format(
                                    worker_id=self._worker_id,
                                    status=self._run_status,
                                )
                            )

                    elif self._run_status == RunStatus.RUNNING:
                        raise RunningPipelineException("Not supposed to have this state")
                    elif self._run_status in [RunStatus.SUCCESS, RunStatus.FAILED]:
                        sock.connect((self._host, self._port))

                        if self._run_status == RunStatus.SUCCESS:
                            status = WorkerMessageType.JOB_FINISHED_SUCCESS
                        elif self._run_status == RunStatus.FAILED:
                            status = WorkerMessageType.JOB_FINISHED_FAILED

                        message = WorkerMessage(
                            worker_id=self._worker_id,
                            run_status=self._run_status,
                            message_type=status,
                            body=self._job,
                            graph_id=self._graph_id
                        )

                        send_msg(sock, message)

                        master_message = recv_msg(sock)

                        if master_message and master_message.message_type == MasterMessageType.AKNOWLEDGE:
                            self._set_run_status(RunStatus.IDLE)
                finally:
                    sock.close()
            except socket.error:
                pass
            except Exception as e:
                self.stop()
                raise

            self._stop_event.wait(timeout=Worker.RUNNER_TIMEOUT)

        logging.info("Exit {}".format(self._run_worker.__name__))

    def _set_run_status(self, run_status):
        self._run_status = run_status
        logging.info(self._run_status)


    def stop(self):
        """Stop Worker."""
        self._stop_event.set()


def run_worker(worker_id=None, verbose=0, host=DEFAULT_HOST, port=DEFAULT_PORT):
    set_logging_level(verbose)
    worker = Worker(
        worker_id=worker_id,
        host=host,
        port=port,
    )

    try:
        worker.serve_forever()
    except KeyboardInterrupt:
        worker.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run worker')
    parser.add_argument('-i', '--worker-id', help='Any string identificator')
    parser.add_argument('-v', '--verbose', action='count', default=0)
    parser.add_argument('-H', '--host', default=DEFAULT_HOST)
    parser.add_argument('-P', '--port', default=DEFAULT_PORT)
    args = parser.parse_args()

    run_worker(**vars(args))
