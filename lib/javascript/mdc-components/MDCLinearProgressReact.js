import React from "react";
import { MDCLinearProgress } from "@material/linear-progress";
import { RefManager } from "../utils/all";

class MDCLinearProgressReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.mdc = new MDCLinearProgress(this.refManager.refs.progress);
  }

  render() {
    let topClasses = ["mdc-linear-progress mdc-linear-progress--indeterminate"];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }
    topClasses = topClasses.join(" ");

    return (
      <div
        role="progressbar"
        ref={this.refManager.nrefs.progress}
        className={topClasses}
        aria-label="Progress Bar"
      >
        <div className="mdc-linear-progress__buffer">
          <div className="mdc-linear-progress__buffer-bar"></div>
          <div className="mdc-linear-progress__buffer-dots"></div>
        </div>
        <div className="mdc-linear-progress__bar mdc-linear-progress__primary-bar">
          <span className="mdc-linear-progress__bar-inner"></span>
        </div>
        <div className="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
          <span className="mdc-linear-progress__bar-inner"></span>
        </div>
      </div>
    );
  }
}

export default MDCLinearProgressReact;
