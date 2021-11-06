## Usage

### Pre Requisites

Before running any command, make sure to install dependencies:

```
$ yarn
```

Before deploying to a live network or running tests, make sure to fill environment variables:

```
$ cp .env.example .env
```

### Compile

Compile the smart contracts with Hardhat:

```
$ yarn compile
```

### Deploy contract to a live network + validate to etherscan

Note: requires mnemonic and Moralis API key

```
$ npx hardhat run scripts/nft-deploy.ts --network rinkeby
```

### Test contract locally

Note: requires Moralis API key

```
$ yarn test
```

### Recompile contracts and regenerate types

```
$ yarn build
```
