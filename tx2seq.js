const neodoc = require("neodoc");

const { CLIDebugger } = require("@truffle/core/lib/debug/cli");
const { selectors: $ } = require("@truffle/debugger");

const commandName = "tx2seq";
const usage = `
usage: tx2seq [--fetch-external|-x] <tx-hash>

options:
  --fetch-external, -x
    Fetch external sources from EtherScan and Sourcify
`;


const run = async (config) => {
  const { txHash } = parseOptions(process.argv);

  const cli = new CLIDebugger(
    config.with({
      logger: {
        log: () => {}
      }
    }),
    { txHash }
  );

  const bugger = await cli.connect();

  let lines = [];
  const participants = {};

  const activations = [];

  let lastStacktrace = [];
  while (!bugger.view($.trace.finished)) {
    const stacktrace = bugger.view($.stacktrace.current.callstack);

    if (stacktrace !== lastStacktrace) {
      if (stacktrace.length === lastStacktrace.length + 1) {
        // new frame
        const [ stackframe ] = stacktrace.slice(-1);

        const participant = makeParticipant(stackframe);
        const { identifier } = participant;
        participants[identifier] = participant;

        lines = [
          ...lines,
          ...sequence.start({
            from: activations[0] || { identifier: "" },
            to: participant,
            functionName: stackframe.functionName
          })
        ];

        activations.unshift(participant);

      } else if (stacktrace.length === lastStacktrace.length - 1) {
        lines = [
          ...lines,
          ...sequence.finish({
            to: activations.shift(),
            from: activations[0] || { identifier: "" }
          })
        ];
      } else {
        console.warn(
          "stacktrace.length %o, lastStacktrace.length %o",
          stacktrace.length,
          lastStacktrace.length
        );
      }

    }
    lastStacktrace = stacktrace;

    bugger.stepNext();
  }

  while (activations.length) {
    lines = [
      ...lines,
      ...sequence.finish({
        to: activations.shift(),
        from: activations[0] || { identifier: "" }
      })
    ];
  }

  const diagram = [
    "@startuml",
    ...Object.values(participants).map(
      ({ name, identifier }) => `participant "${name}" as ${identifier}`
    ),
    ...lines,
    "@enduml"
  ];

  console.log(diagram.join("\n"));
}.trim();

const parseOptions = (args) => {
  // convert raw args for neodoc
  // process.argv will roughly be: `node <truffle-path> run tx2seq ...`
  // and we want `truffle run tx2seq`
  const argv = args.slice(args.indexOf(commandName) + 1)

  const {
    "--fetch-external": fetchExternal,
    "<tx-hash>": txHash
  } = neodoc.run(usage, {
    argv,
    smartOptions: true,
    allowUnknown: true
  });

  return {
    fetchExternal,
    txHash
  };
}

const makeParticipant = (stackframe) => {
  const {
    address,
    contractName,
  } = stackframe;

  const shortAddress = `${address.slice(0, 6)}..${address.slice(-4)}`;

  if (contractName) {
    return {
      name: `${contractName}(${shortAddress})`,
      identifier: `${address}__${contractName}`
    }
  }

  return {
    name: address,
    identifier: address
  };
}

const sequence = {
  start({ from, to, functionName }) {
    const message =
      functionName
        ? `${from.identifier} -> ${to.identifier} : ${functionName}`
        : `${from.identifier} -> ${to.identifier}`;
    return [
      message,
      `activate ${to.identifier}`
    ]
  },

  finish({ from, to }) {
    return [
      `${from.identifier} <-- ${to.identifier}`,
      `deactivate ${to.identifier}`
    ]
  }
}

module.exports = run;
