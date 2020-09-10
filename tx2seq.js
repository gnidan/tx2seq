const util = require("util");
const neodoc = require("neodoc");

const Codec = require("@truffle/codec");
const { CLIDebugger } = require("@truffle/core/lib/debug/cli");
const { selectors: $ } = require("@truffle/debugger");

const commandName = "tx2seq";
const usage = `
usage: ${commandName} [--fetch-external|-x] <tx-hash>

options:
  --fetch-external, -x
    Fetch external sources from EtherScan and Sourcify
`;


const run = async (config) => {
  const { txHash, fetchExternal } = parseOptions(process.argv);

  const cli = new CLIDebugger(
    config.with({
      fetchExternal,
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

    bugger.advance();

    if (stacktrace !== lastStacktrace) {
      if (stacktrace.length === lastStacktrace.length + 1) {
        // new frame
        const [ stackframe ] = stacktrace.slice(-1);

        const participant = makeParticipant(stackframe);
        const { identifier } = participant;

        if (stackframe.contractName) {
          participants[identifier] = participant;

          const node = bugger.view($.data.current.function);

          const variables = await bugger.variables();

          const parameters = node && node.parameters
            ? node.parameters.parameters.map(
              ({ name }) => ({
                name,
                result: variables[name]
              })
            )

            : [];

          const from = activations
            .find(
              ({ name, identifier }) => name !== identifier
            ) || { identifier: "" };

          lines = [
            ...lines,
            ...sequence.start({
              from,
              // from: activations[0] || { identifier: "" },
              to: participant,
              functionName: stackframe.functionName,
              parameters
            })
          ];
        }

        activations.unshift(participant);
      } else if (stacktrace.length === lastStacktrace.length - 1) {
        const to = activations.shift();

        const fromIndex = activations
          .findIndex(
            ({ name, identifier }) => name !== identifier
          );

        for (const i = 0; i < fromIndex; i++) {
          activations.shift();
        }

        const from = activations[0] || { identifier: "" };

        if (to.name !== to.identifier) {
          lines = [
            ...lines,
            ...sequence.finish({
              from,
              to
            })
          ];
        }
      } else {
        console.warn(
          "stacktrace.length %o, lastStacktrace.length %o",
          stacktrace.length,
          lastStacktrace.length
        );
      }

    }
    lastStacktrace = stacktrace;
  }

  while (activations.length) {
    const to = activations.shift();

    const fromIndex = activations.findIndex(
      ({ name, identifier }) => name !== identifier
    );

    const amountToShift =
      fromIndex === -1
        ? activations.length
        : fromIndex === 0
          ? 0
          : fromIndex - 1;

    for (let i = 0; i < amountToShift; i++) {
      activations.shift();
    }



    const from = activations[0] || { identifier: "" };

    if (to.name !== to.identifier) {
      lines = [
        ...lines,
        ...sequence.finish({
          from,
          to
        })
      ];
    }
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
}

const parseOptions = (args) => {
  // convert raw args for neodoc
  // process.argv will roughly be: `node <truffle-path> run tx2seq ...`
  // and we want `truffle run tx2seq`
  const argv = args.slice(args.indexOf(commandName) + 1)

  const {
    "<tx-hash>": txHash,
    ...options
  } = neodoc.run(usage, {
    argv,
    smartOptions: true,
    allowUnknown: true
  });

  const fetchExternal = options["--fetch-external"] || options["-x"];

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
  start({ from, to, functionName, parameters = [] }) {
    // console.debug("start");
    // console.debug("from %o", from.identifier);
    // console.debug("to %o", to.identifier);
    // console.debug("");
    const arguments = parameters
      .map(
        ({ name, result }) => result
          ? `${name}: **${util.inspect(new Codec.Format.Utils.Inspect.ResultInspector(result))}**`
          : `${name}: <unknown>`
      )
      .join(",\\n  ");

    const call = parameters.length
      ? `**${functionName}**(\\n  ${arguments}\\n)`
      : `**${functionName}**()`;

    const message =
      functionName
        ? `${from.identifier} -> ${to.identifier} : ${call}`
        : `${from.identifier} -> ${to.identifier}`;
    return [
      message,
      `activate ${to.identifier}`
    ]
  },

  finish({ from, to }) {
    // console.debug("finish");
    // console.debug("from %o", from.identifier);
    // console.debug("to %o", to.identifier);
    // console.debug("");
    return [
      `${from.identifier} <-- ${to.identifier}`,
      `deactivate ${to.identifier}`
    ]
  }
}

module.exports = run;
