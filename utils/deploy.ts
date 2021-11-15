import { ethers } from "hardhat";
import { delay, fromMin, fromSec } from ".";
import editJsonFile from "edit-json-file";
import { ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "hardhat-deploy-ethers/dist/src/signers";
import { VoidSigner } from "ethers";
const hre = require("hardhat");

type DeployParam<T extends ContractFactory> = Parameters<InstanceType<{ new (): T }>["deploy"]>;
type ContractInstance<T extends ContractFactory> = ReturnType<InstanceType<{ new (): T }>["attach"]>;

interface ContractLog {
  address: string;
  txHash: string;
  args: any;
}

export class MacroChain {
  readonly owner: SignerWithAddress;
  readonly users: SignerWithAddress[];
  readonly zero: VoidSigner;

  constructor(signer: SignerWithAddress | SignerWithAddress[]) {
    if (Array.isArray(signer)) {
      this.users = signer;
    } else {
      this.users[0] = signer;
    }
    this.owner = this.users[0];
    this.zero = new ethers.VoidSigner(ethers.constants.AddressZero, ethers.provider);
  }

  static init = async (): Promise<MacroChain> => {
    const signers = await ethers.getSigners();
    const macrochain = new MacroChain(signers);
    return macrochain;
  };

  deployer = async <T extends ContractFactory>(
    contractName: string,
    param: DeployParam<T>,
    log = false,
  ): Promise<ContractInstance<T>> => {
    const contractFactory = (await ethers.getContractFactory(contractName, this.owner)) as T;
    const contract = (await contractFactory.deploy(...param)) as ContractInstance<T>;

    if (log) {
      console.log("***********************************");
      console.log("Contract: " + contractName);
      console.log("Address:  " + contract.address);
      console.log("TX hash:  " + contract.deployTransaction.hash);
      console.log("...waiting for confirmation");
    }

    await contract.deployed();

    if (log) {
      console.log("Confirmed!");
      const file = editJsonFile("./cache/deploymentLogs.json");
      const contractLog: ContractLog = {
        address: contract.address,
        txHash: contract.deployTransaction.hash,
        args: param,
      };
      file.set(contractName, contractLog);
      file.save();
    }

    return contract;
  };

  getInstance = async <T extends ContractFactory>(
    contractName: string,
    newAddr?: string,
  ): Promise<ContractInstance<T>> => {
    const contractFactory = (await ethers.getContractFactory(contractName, this.owner)) as T;

    if (newAddr) {
      return contractFactory.attach(newAddr) as ContractInstance<T>;
    } else {
      const file = editJsonFile("./cache/deploymentLogs.json");
      const addr = file.get(`${contractName}.address`);
      if (addr) {
        return contractFactory.attach(addr) as ContractInstance<T>;
      } else {
        throw "Invalid contract name or contract address";
      }
    }
  };
}

export const verifyContract = async (...contracts: string[]): Promise<void> => {
  console.log("***********************************");
  console.log("Begin verification...");
  console.log("(This will take some time. You can already interact with contract while you wait.)");

  const file = editJsonFile("./cache/deploymentLogs.json");
  const { length } = contracts;

  await delay(fromMin(2));

  for (let i = 0; i < length; i++) {
    const contract = file.get(contracts[i]) as ContractLog;
    const source = await getContractSource(contracts[i]);

    console.log("***********************************");
    console.log(`Working on contract: ${contract.address} (${i + 1} out of ${length})`);

    if (contract) {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
        contract: source,
      });
    } else {
      throw "Invalid contract name or the contract does not exist";
    }

    i + 1 < length && (await delay(fromSec(10)));
  }

  console.log("...Finished!");
};

const getContractSource = async (contractName: string): Promise<string | undefined> => {
  const sourceNames = (await hre.artifacts.getAllFullyQualifiedNames()) as string[];
  for (let i = 0; i < sourceNames.length; i++) {
    const parts = sourceNames[i].split(":");
    if (parts[1] === contractName) {
      return sourceNames[i];
    }
  }
  return undefined;
};
