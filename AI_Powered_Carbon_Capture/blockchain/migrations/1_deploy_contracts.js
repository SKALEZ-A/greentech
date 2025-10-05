const CarbonCredit = artifacts.require("CarbonCredit");
const CarbonCreditMarketplace = artifacts.require("CarbonCreditMarketplace");

module.exports = function(deployer, network, accounts) {
  const owner = accounts[0];
  const feeRecipient = accounts[1] || owner;
  const platformFee = 250; // 2.5%

  console.log("Deploying contracts...");
  console.log("Network:", network);
  console.log("Owner:", owner);

  // Deploy CarbonCredit contract first
  deployer.deploy(CarbonCredit, { from: owner })
    .then(() => {
      console.log("CarbonCredit deployed at:", CarbonCredit.address);

      // Deploy CarbonCreditMarketplace with CarbonCredit address
      return deployer.deploy(
        CarbonCreditMarketplace,
        CarbonCredit.address,
        feeRecipient,
        platformFee,
        { from: owner }
      );
    })
    .then(() => {
      console.log("CarbonCreditMarketplace deployed at:", CarbonCreditMarketplace.address);

      // Log deployment summary
      console.log("\n=== Deployment Summary ===");
      console.log("CarbonCredit:", CarbonCredit.address);
      console.log("CarbonCreditMarketplace:", CarbonCreditMarketplace.address);
      console.log("Network:", network);
      console.log("Owner:", owner);
      console.log("Fee Recipient:", feeRecipient);
      console.log("Platform Fee:", platformFee / 100 + "%");
    })
    .catch((error) => {
      console.error("Deployment failed:", error);
      throw error;
    });
};
