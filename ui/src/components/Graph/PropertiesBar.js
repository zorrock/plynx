// src/components/About/index.js
import React, { Component } from 'react';
import ParameterItem from './ParameterItem.js'
import OutputItem from './OutputItem.js'
import { Link } from 'react-router-dom';
import './style.css';

export default class PropertiesBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      graphId: props.graphId,
      nodeId: null,
      bigTitle: "Graph",
      parameters: [
        {
          name: 'title',
          parameter_type: "str",
          value: props.graphTitle,
          widget: {
            alias: "Title"
          }
        },
        {
          name: 'description',
          parameter_type: "str",
          value: props.graphDescription,
          widget: {
            alias: "Description"
          }
        }
      ],
      outputs: [],
      logs: [],
      editable: true
    };

    if ('editable' in props) {
      this.state.editable = props.editable;
    }
  }

  setNodeData(graphId, nodeId, base_node_name, bigTitle, bigDescription, parameters, outputs, logs, parent_node) {
    parameters = parameters.slice(0);
    parameters.unshift({
      name: '_DESCRIPTION',
      widget: {
        alias: 'Description',
      },
      value: bigDescription,
      parameter_type: 'str',
    })
    this.setState(
      {
        graphId: graphId,
        nodeId: nodeId,
        bigTitle: bigTitle,
        parameters: parameters,
        outputs: outputs,
        logs: logs,
        parent_node: parent_node,
        base_node_name: base_node_name
      }
    );
  }

  setGraphData(graphId, bigTitle, parameters) {
    this.setState(
      {
        graphId: graphId,
        nodeId: null,
        bigTitle: bigTitle,
        parameters: parameters,
        outputs: [],
        logs: []
      }
    );
  }

  clearData() {
    this.setState({
      nodeId: "",
      title: "",
      parameters: []
    });
  }

  handleParameterChanged(name, value) {
    this.props.onParameterChanged(this.state.nodeId, name, value);
  }

  handlePreview(previewData) {
    if (this.props.onPreview) {
      this.props.onPreview(previewData);
    }
  }

  render() {
    var self = this;
    var parametersList = []
    if (this.state.parameters) {
      parametersList = this.state.parameters.filter(
        (parameter) => {return parameter.widget != null}
      )
      .map(
        (parameter) => <ParameterItem
          name={parameter.name}
          alias={parameter.widget.alias}
          value={parameter.value}
          parameterType={parameter.parameter_type}
          key={this.state.nodeId + "$" + parameter.name}
          readOnly={!this.state.editable}
          onParameterChanged={(name, value)=>this.handleParameterChanged(name, value)}
          />);
    }
    var outputsList = this.state.outputs.filter(
      (output) => {return output.resource_id != null}
    ).map(
      function (output) {
        return <OutputItem
          graphId={self.state.graphId}
          resourceName={output.name}
          resourceId={output.resource_id}
          nodeId={self.state.nodeId}
          key={self.state.nodeId + "$" + output.name}
          fileType={output.file_type}
          onPreview={(previewData) => self.handlePreview(previewData)}
          />;
        }
      );

    var logsList = [];
    if (this.state.logs) {
      logsList= this.state.logs.filter(
        (log) => {return log.resource_id}
        ).map(
        (log) => <OutputItem
          graphId={this.state.graphId}
          resourceName={log.name}
          resourceId={log.resource_id}
          nodeId={this.state.nodeId}
          key={this.state.nodeId + '$' + log.name}
          fileType={'file'}
          onPreview={(previewData) => this.handlePreview(previewData)}
        />);
    }

    return (
      <div className="PropertiesBar"
        onClick={(e) => {e.stopPropagation()}}
        onMouseDown={(e) => {e.stopPropagation()}}
        >
        {
          !this.state.nodeId &&
          <div className="PropertiesHeader">{(this.state.bigTitle ? this.state.bigTitle + ' ' : ' ') + 'Properties'}</div>
        }
        {
          (this.state.nodeId && this.state.base_node_name !== 'file') &&
          <Link to={'/nodes/' + this.state.parent_node}>
            <div className="PropertiesHeader">
              {(this.state.bigTitle ? this.state.bigTitle + ' ' : ' ')}<img src="/icons/external-link.svg" width="12" height="12" alt="^" />
            </div>
          </Link>
        }
        {
          (this.state.nodeId && this.state.base_node_name === 'file') &&
          <a href={null} onClick={
            (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.props.onFileShow(this.state.nodeId);
            }
          }>
            <div className="PropertiesHeader">
              {(this.state.bigTitle ? this.state.bigTitle + ' ' : ' ')}<img src="/icons/external-link.svg" width="12" height="12" alt="^" />
            </div>
          </a>
        }



        <div className="ParametersHeader">Parameters</div>
        {parametersList}
        {!this.state.editable &&
          <div className="OptionalOutputsBox">
            {outputsList.length > 0 &&
              <div className="OutputsBox">
                <div className="OutputsHeader">Outputs</div>
                {outputsList}
              </div>
            }
            {logsList.length > 0 &&
              <div className="LogsBox">
                <div className="LogsHeader">Logs</div>
                {logsList}
              </div>
            }
          </div>
        }
      </div>
    );
  }
}
