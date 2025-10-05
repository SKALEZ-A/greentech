const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Carbon Capture smart contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy CarbonCredit contract
  console.log("\n1. Deploying CarbonCredit contract...");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await CarbonCredit.deploy();
  await carbonCredit.deployed();
  console.log("CarbonCredit deployed to:", carbonCredit.address);

  // Deploy CarbonCreditMarketplace contract
  console.log("\n2. Deploying CarbonCreditMarketplace contract...");
  const CarbonCreditMarketplace = await ethers.getContractFactory("CarbonCreditMarketplace");

  // Platform fee: 2.5% (250 basis points)
  const platformFee = 250;
  const feeRecipient = deployer.address; // Use deployer as fee recipient for now

  const marketplace = await CarbonCreditMarketplace.deploy(
    carbonCredit.address,
    feeRecipient,
    platformFee
  );
  await marketplace.deployed();
  console.log("CarbonCreditMarketplace deployed to:", marketplace.address);

  // Authorize marketplace as operator on CarbonCredit contract (if needed)
  console.log("\n3. Setting up contract permissions...");

  // Verify deployments
  console.log("\n4. Verifying deployments...");
  await verifyDeployment(carbonCredit, "CarbonCredit");
  await verifyDeployment(marketplace, "CarbonCreditMarketplace");

  // Save deployment addresses
  const deploymentInfo = {
    network: network.name,
    carbonCredit: carbonCredit.address,
    marketplace: marketplace.address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    platformFee: platformFee,
    feeRecipient: feeRecipient,
  };

  console.log("\nDeployment completed successfully!");
  console.log("Contract addresses:");
  console.log("- CarbonCredit:", carbonCredit.address);
  console.log("- CarbonCreditMarketplace:", marketplace.address);

  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, '..', 'deployments');

  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }

  const filename = `deployment-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentPath, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\nDeployment info saved to: ${filename}`);

  return {
    carbonCredit: carbonCredit.address,
    marketplace: marketplace.address,
    deploymentInfo
  };
}

async function verifyDeployment(contract, contractName) {
  try {
    console.log(`Verifying ${contractName}...`);
    await contract.deployTransaction.wait(5); // Wait for 5 confirmations

    // Additional verification logic can be added here
    const code = await ethers.provider.getCode(contract.address);
    if (code === '0x') {
      throw new Error('Contract deployment failed');
    }

    console.log(`${contractName} verified successfully`);
  } catch (error) {
    console.error(`Error verifying ${contractName}:`, error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
