;(function() {
	"use strict";
	owid.namespace("owid.dataflow");

	owid.dataflow = function() {
		var model = {}, state = {}, defaults = {}, flows = [];
		model.state = state;

		function defineProperty(key, val) {
			state[key] = undefined;
			defaults[key] = val;

			if (!model.hasOwnProperty(key)) {
				Object.defineProperty(model, key, {
					get: function() { return state[key]; }
				});
			}
		}

		model.inputs = function(inputs) {
			_.each(inputs, function(v, k) {
				defineProperty(k, v);
			});
		};

		function parseFlowspec(flowspec) {
			var flow = {},
				spl = flowspec.split(/\s*:\s*/);

			flow.spec = flowspec;
			flow.outputs = spl[1] ? spl[0].split(/\s*,\s*/) : [];
			flow.inputs = spl[1] ? spl[1].split(/\s*,\s*/) : spl[0].split(/\s*,\s*/);

			return flow;
		}

		model.flow = function(flowspec, callback) {
			var flow = parseFlowspec(flowspec);
			flow.callback = callback;

			_.each(flow.outputs, function(key) {
				defineProperty(key);
			});

			flows.push(flow);
		};

		// Immediate flow, requiring inputs
		model.now = function(flowspec, callback) {
			var flow = parseFlowspec(flowspec);

			var args = _.map(flow.inputs, function(key) {
				if (!_.has(state, key))
					throw("Missing input value: " + k);

				return state[key];
			});

			callback.apply(model, args);
		};

		function isEqual(a, b) {
			return _.isEqual(a, b);
		}

		var hasDefaults = false;
		model.update = function(inputs) {
			var changes = {};

			if (!hasDefaults) {
				// Make sure we're not passing undefined values in
				var newInputs = _.clone(defaults);
				_.each(inputs, function(v,k) {
					if (v !== undefined) newInputs[k] = v;
				});
				inputs = newInputs;

				hasDefaults = true;
			}

			_.each(inputs, function(v, k) {
				if (!_.has(state, k))
					throw("No such input: " + k);
				if (!isEqual(state[k], v)) {
					state[k] = v;
					changes[k] = true;
				}
			});

			_.each(flows, function(flow) {
				var inputChanged =_.any(flow.inputs, function(k) { return _.has(changes, k); });
				if (!inputChanged) return;

				var hasArgs = true;
				var args = _.map(flow.inputs, function(k) { 
					if (!state.hasOwnProperty(k)) { hasArgs = false; }
					return state[k];
				});

				if (!hasArgs)
					return;

//				console.log(flow.spec);

				var outputs = flow.callback.apply(model, args);

				if (flow.outputs.length == 1) outputs = [outputs];

				for (var i = 0; i < flow.outputs.length; i++) {
					var key = flow.outputs[i],
						result = outputs[i],
						oldResult = state[key];

					if ((result && result.hasOwnProperty('state')) || !isEqual(oldResult, result)) {
						state[key] = result;
						changes[key] = true;
					}
				}
			});
		};

		return model;
	};
})();