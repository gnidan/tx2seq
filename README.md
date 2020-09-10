# tx2seq

Messing around with @truffle/debugger as a library, to generate sequence
diagrams.

:information_source: **Note: this is an experiment! This is not maintained!
The diagrams this produces are almost certainly wrong, and potentially
dangerously misleading.**


_The current plan for this is to make it
part of Truffle itself. This repo exists for people that want to try it out
in its buggy, incomplete state._

## Example output

Example ERC20 transfer

![`truffle run tx2seq -x 0x87d5cb3a0ddabc16da9a0cdec33b146c0225ea79291cdf1077eaa20d9858461c`](./transfer.svg)

## How to use

### Clone Truffle

This requires two changes to Truffle that aren't merged yet. You'll need to run a local dev clone:

```console
$ git clone git@github.com:trufflesuite/truffle.git
$ cd truffle
$ git checkout bag/tx2seq
$ yarn bootstrap
```

### Clone this repo

This repo isn't published to NPM so you'll need to clone + link manually.

```console
$ git clone git@github.com:gnidan/tx2seq.git
$ cd tx2seq
$ yarn link
```

Alright!

### Configure your Truffle project

This can either be your existing project, or a fresh `truffle init`.

#### Set up shell alias to use your local Truffle clone

So that when you run `truffle`, you'll use your local clone instead of what's
installed.

```console
$ alias truffle=node\ <path-to-repo>/packages/truffle/build/cli.bundled.js
```

#### Link your local clone of this repo

```
$ yarn link tx2seq
```

#### Update truffle-config.js

**Requirement**: _you need an archive node for this!_ Preferably one that exposes
geth-style `debug_traceTransaction`, but `ganache-cli --fork` will do,
provided:

- You're having Ganache re-use the same network ID (so if you're forking
  `mainnet`, then Ganache better also say that `net_version` is `1`)
- You're not only pretending to fork an archive node when really you're forking
  a regular full node.
- You don't fall victim to one of the ~4 remaining known forking bugs. BTW
  you probably want to take this opportunity to **upgrade to ganache-cli
  [v6.10.2](https://github.com/trufflesuite/ganache-cli/releases/tag/v6.10.2)**

OK good to go? Update your `truffle-config.js`! Make sure you configure your
network and add the plugin:

```javascript
module.exports = {
  // ... rest of truffle-config ...

  networks: {
    // ... rest of networks ...

    // make sure the aforementioned debuggable archive node is configured
    fork: {
      // ...
    }
  },

  // add the plugin
  plugins: [
    // ... rest of plugins ...

    "tx2seq"
  ]
}
```

### Invoke the power of sequence diagrams

With all that, just run:

```console
$ truffle run tx2seq \
    --network=fork --fetch-external <tx-hash> \
  > sequence.plantuml
```

Since it's 2020, you probably don't have Java installed, so just copy the
contents of `sequence.plantuml` and head over to https://www.planttext.com/
and paste.

Voilà!
