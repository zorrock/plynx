// src/components/NotFound/index.js
import React, { Component } from 'react';
import Rnd from 'react-rnd'

import './Dialog.css';

export default class Dialog extends Component{

  constructor(props) {
    super(props);

    this.state = {
      width: this.props.width,
      height: this.props.height
    }

    this.x = -100;
    this.y = -100;
  }

  handleClose(e) {
    this.noop(e);
    this.props.onClose();
  }

  handleBackgroundMouseDown(e) {
    this.x = e.screenX;
    this.y = e.screenY;
  }

  handleBackgroundMouseUp(e) {
    if (Math.pow(this.x - e.screenX, 2) + Math.pow(this.y - e.screenY, 2) < 25) {
      this.handleClose(e);
    }
    this.x = -1;
    this.y = -1;
  }

  noop(e) {
    e.stopPropagation();
  }

  render() {
    return (
      <div className='dialog noselect'
           onMouseDown={(e) => this.handleBackgroundMouseDown(e)}
           onMouseUp={(e) => this.handleBackgroundMouseUp(e)}
      >
        <Rnd
          className='dialog-rnd'
          default={{
            x: (window.innerWidth - this.props.width) / 2,
            y: (window.innerHeight - this.props.height)/ 2,
            width: this.props.width,
            height: this.props.height,
          }}
          minWidth={400}
          minHeight={100}
          onResize={(e, direction, ref, delta, position) => {
            this.setState({
              width: ref.offsetWidth,
              height: ref.offsetHeight,
              ...position,
            });
          }}
          onClick={(e) => this.noop(e)}
          onMouseUp={(e) => this.noop(e)}
          enableResizing={this.props.enableResizing}
          bounds='parent'
        >
          <div className='dialog-window'
          >
            <div className='header'
              onClick={(e) => this.noop(e)}
              onMouseUp={(e) => this.noop(e)}
            >
              <a className="close-button"
                 href={null}
                 onClick={(e) => this.handleClose(e)}
              >
                &#215;
              </a>
              <div className='title noselect'
                   onClick={(e) => {this.noop(e)}}
              >
                {this.props.title}
              </div>
            </div>
            <div className='content'
                 onClick={(e) => {this.noop(e)}}
                 onMouseDown={(e) => {this.noop(e)}}
            >
              {this.props.children}
            </div>
          </div>
        </Rnd>
      </div>
    );
  }
}
