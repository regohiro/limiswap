import { ethers } from "ethers";
import { LimiSwap__factory } from "../typechain";
const hre = require("hardhat");

const main = async () => {
  const rpcURL = "https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";
  const addr = "0x2d8949bb3B33F63318F52a1609509a4B1CA6Bfb8";
  const provider = new ethers.providers.JsonRpcProvider(rpcURL);
  const signer = new ethers.VoidSigner(ethers.constants.AddressZero, provider);

  const limiswap = LimiSwap__factory.connect(addr, signer);
  const res = await limiswap.callStatic.checkUpkeep("0x");
  console.log(res);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })
