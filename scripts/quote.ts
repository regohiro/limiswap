import { ethers } from "hardhat";
import { fromBN, MacroChain, toWei } from "../utils";
const hre = require("hardhat");

const main = async () => {
  const { zero } = await MacroChain.init();
  const addr = "0xb2fD655253F089b73136Ce8843337743D02E0377";
  const abi = ["function getOutput(uint256 amountIn) external returns (uint256 amountOut)"];

  const quote = new ethers.Contract(addr, abi, zero);
  const amountIn = toWei(1);
  const res = await quote.callStatic.getOutput(amountIn);
  const amountOut = fromBN(res);
  console.log(amountOut);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })

