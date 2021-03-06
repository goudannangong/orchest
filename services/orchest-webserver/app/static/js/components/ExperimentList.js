import React, { Fragment } from "react";

import SearchableTable from "./SearchableTable";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import CreateExperimentView from "../views/CreateExperimentView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import ExperimentView from "../views/ExperimentView";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";

class ExperimentList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      createModal: false,
      createModelLoading: false,
      experiments: undefined,
      pipelines: undefined,
      experimentsSearchMask: new Array(0).fill(1),
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    // retrieve pipelines once on component render
    let pipelinePromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${this.props.project_uuid}`),
      this.promiseManager
    );

    pipelinePromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          pipelines: result.result,
        });
      })
      .catch((e) => {
        console.log(e);
      });

    // retrieve experiments
    this.fetchList();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {}

  fetchList() {
    // in case experimentTable exists, clear checks
    if (this.refManager.refs.experimentTable) {
      this.refManager.refs.experimentTable.setSelectedRowIds([]);
    }

    let fetchListPromise = makeCancelable(
      makeRequest(
        "GET",
        `/store/experiments?project_uuid=${this.props.project_uuid}`
      ),
      this.promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          experiments: result,
          experimentsSearchMask: new Array(result.length).fill(1),
        });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  componentWillUnmount() {}

  onCreateClick() {
    this.setState({
      createModal: true,
    });
  }

  onDeleteClick() {
    // get experiment selection
    let selectedRows = this.refManager.refs.experimentTable.getSelectedRowIndices();

    if (selectedRows.length == 0) {
      orchest.alert("Error", "You haven't selected any experiments.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you sure you want to delete these experiments? (This cannot be undone.)",
      () => {
        // delete indices
        let promises = [];

        for (let x = 0; x < selectedRows.length; x++) {
          promises.push(
            // deleting the experiment will also
            // take care of aborting it if necessary
            makeRequest(
              "DELETE",
              "/store/experiments/" +
                this.state.experiments[selectedRows[x]].uuid
            )
          );
        }

        Promise.all(promises).then(() => {
          this.fetchList();

          this.refManager.refs.experimentTable.setSelectedRowIds([]);
        });
      }
    );
  }

  onSubmitModal() {
    let pipeline_uuid = this.refManager.refs.formPipeline.mdc.value;
    let pipelineName;
    for (let x = 0; x < this.state.pipelines.length; x++) {
      if (this.state.pipelines[x].uuid === pipeline_uuid) {
        pipelineName = this.state.pipelines[x].name;
        break;
      }
    }

    if (this.refManager.refs.formExperimentName.mdc.value.length == 0) {
      orchest.alert("Error", "Please enter a name for your experiment.");
      return;
    }

    if (this.refManager.refs.formPipeline.mdc.value == "") {
      orchest.alert("Error", "Please choose a pipeline.");
      return;
    }

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    this.setState({
      createModelLoading: true,
    });

    makeRequest("POST", "/store/experiments/new", {
      type: "json",
      content: {
        pipeline_uuid: pipeline_uuid,
        pipeline_name: pipelineName,
        project_uuid: this.props.project_uuid,
        name: this.refManager.refs.formExperimentName.mdc.value,
        draft: true,
      },
    }).then((response) => {
      let experiment = JSON.parse(response);

      orchest.loadView(CreateExperimentView, {
        experiment: {
          name: experiment.name,
          pipeline_uuid: pipeline_uuid,
          project_uuid: this.props.project_uuid,
          uuid: experiment.uuid,
        },
      });
    });
  }
  onCancelModal() {
    this.refManager.refs.createExperimentDialog.close();
  }

  onCloseCreateExperimentModal() {
    this.setState({
      createModal: false,
    });
  }

  onRowClick(row, idx, event) {
    let experiment = this.state.experiments[idx];

    if (experiment.draft === true) {
      orchest.loadView(CreateExperimentView, {
        experiment: {
          name: experiment.name,
          pipeline_uuid: experiment.pipeline_uuid,
          project_uuid: experiment.project_uuid,
          uuid: experiment.uuid,
        },
      });
    } else {
      let pipelineJSONEndpoint = getPipelineJSONEndpoint(
        experiment.pipeline_uuid,
        experiment.project_uuid,
        experiment.uuid
      );

      makeRequest("GET", pipelineJSONEndpoint).then((response) => {
        let result = JSON.parse(response);
        if (result.success) {
          let pipeline = JSON.parse(result["pipeline_json"]);

          orchest.loadView(ExperimentView, {
            pipeline: pipeline,
            experiment: experiment,
            parameterizedSteps: JSON.parse(experiment.strategy_json),
          });
        } else {
          console.warn("Could not load pipeline.json");
          console.log(result);
        }
      });
    }
  }

  experimentListToTableData(experiments) {
    let rows = [];
    for (let x = 0; x < experiments.length; x++) {
      // keep only experiments that are related to a project!
      rows.push([
        experiments[x].name,
        experiments[x].pipeline_name,
        new Date(
          experiments[x].created.replace(/T/, " ").replace(/\..+/, "") + " GMT"
        ).toLocaleString(),
        experiments[x].draft ? "Draft" : "Submitted",
      ]);
    }
    return rows;
  }

  generatePipelineOptions(pipelines) {
    let pipelineOptions = [];

    for (let x = 0; x < pipelines.length; x++) {
      pipelineOptions.push([pipelines[x].uuid, pipelines[x].name]);
    }

    return pipelineOptions;
  }

  render() {
    return (
      <div className={"experiments-page"}>
        <h2>Experiments</h2>

        {(() => {
          if (this.state.experiments && this.state.pipelines) {
            return (
              <Fragment>
                {(() => {
                  if (this.state.createModal) {
                    return (
                      <MDCDialogReact
                        title="Create a new experiment"
                        ref={this.refManager.nrefs.createExperimentDialog}
                        onClose={this.onCloseCreateExperimentModal.bind(this)}
                        content={
                          <Fragment>
                            <div className="create-experiment-modal">
                              <MDCTextFieldReact
                                ref={this.refManager.nrefs.formExperimentName}
                                classNames={["fullwidth push-down"]}
                                label="Experiment name"
                              />

                              <MDCSelectReact
                                ref={this.refManager.nrefs.formPipeline}
                                label="Pipeline"
                                classNames={["fullwidth"]}
                                options={this.generatePipelineOptions(
                                  this.state.pipelines
                                )}
                              />

                              {(() => {
                                if (this.state.createModelLoading) {
                                  return (
                                    <Fragment>
                                      <MDCLinearProgressReact />
                                      <p>Copying pipeline directory...</p>
                                    </Fragment>
                                  );
                                }
                              })()}
                            </div>
                          </Fragment>
                        }
                        actions={
                          <Fragment>
                            <MDCButtonReact
                              disabled={this.state.createModelLoading}
                              icon="science"
                              classNames={[
                                "mdc-button--raised",
                                "themed-secondary",
                              ]}
                              label="Create experiment"
                              submitButton
                              onClick={this.onSubmitModal.bind(this)}
                            />
                            <MDCButtonReact
                              icon="close"
                              classNames={["push-left"]}
                              label="Cancel"
                              onClick={this.onCancelModal.bind(this)}
                            />
                          </Fragment>
                        }
                      />
                    );
                  }
                })()}

                <div className={"experiment-actions"}>
                  <MDCIconButtonToggleReact
                    icon="add"
                    tooltipText="Add experiment"
                    onClick={this.onCreateClick.bind(this)}
                  />
                  <MDCIconButtonToggleReact
                    icon="delete"
                    tooltipText="Delete experiment"
                    onClick={this.onDeleteClick.bind(this)}
                  />
                </div>

                <SearchableTable
                  ref={this.refManager.nrefs.experimentTable}
                  selectable={true}
                  onRowClick={this.onRowClick.bind(this)}
                  rows={this.experimentListToTableData(this.state.experiments)}
                  headers={["Experiment", "Pipeline", "Date created", "Status"]}
                />
              </Fragment>
            );
          } else {
            return <MDCLinearProgressReact />;
          }
        })()}
      </div>
    );
  }
}

export default ExperimentList;
