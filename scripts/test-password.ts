import { hashPassword, verifyPassword } from "../src/utils/password.js";

async function testPasswordUtility() {
  const password = "ExamplePassword123!";

  try {
    // Generate two hashes from the same password.
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    // Verify the original password.
    const correctPassword = await verifyPassword(password, firstHash);

    // Verify an incorrect password.
    const incorrectPassword = await verifyPassword(
      "WrongPassword123!",
      firstHash,
    );

    console.log("First hash generated:", Boolean(firstHash));
    console.log("Second hash generated:", Boolean(secondHash));

    console.log(
      "Different hashes for same password:",
      firstHash !== secondHash,
    );

    console.log("Correct password accepted:", correctPassword);
    console.log("Incorrect password rejected:", !incorrectPassword);
  } catch (error) {
    console.error("Password utility test failed:", error);
    process.exitCode = 1;
  }
}

testPasswordUtility();
