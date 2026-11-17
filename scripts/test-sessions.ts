/// <reference types="node" />

import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/database/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
} from "../src/modules/auth/session.service.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function testRefreshSessions() {
  const username = `session-test-${randomUUID()}`;
  let userId: string | undefined;

  try {
    // Create a temporary test user.
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword("TemporaryTestPassword123!"),
        role: "EMPLOYEE",
        isActive: true,
      },
    });

    userId = user.id;

    console.log("Test user created.");

    // Test 1: Create a refresh session.
    const originalToken = randomUUID() + randomUUID();

    await createRefreshSession(user.id, originalToken);

    console.log("PASS: Refresh session created.");

    // Test 2: Rotate the refresh token.
    const rotation = await rotateRefreshSession(originalToken);

    if (!rotation || rotation.kind !== "success") {
      throw new Error(
        `Expected successful rotation, received: ${rotation?.kind ?? "null"}`,
      );
    }

    assert.equal(rotation.user.id, user.id);

    console.log("PASS: Refresh token rotated successfully.");

    // Test 3: An immediate retry should be treated as concurrent.
    const concurrentReuse = await rotateRefreshSession(originalToken);

    assert.ok(concurrentReuse);
    assert.equal(concurrentReuse.kind, "concurrent");

    console.log("PASS: Concurrent refresh request handled safely.");

    // Test 4: Reusing the old token after the grace period
    // should revoke the entire session family.
    console.log("Waiting for the refresh-token grace period...");

    await sleep(10_100);

    const delayedReuse = await rotateRefreshSession(originalToken);

    assert.ok(delayedReuse);
    assert.equal(delayedReuse.kind, "reuse");

    console.log("PASS: Delayed refresh-token reuse detected.");

    // Test 5: The replacement token should also be rejected
    // because its session family was revoked.
    const replacementAfterReuse = await rotateRefreshSession(
      rotation.refreshToken,
    );

    assert.equal(replacementAfterReuse, null);

    console.log("PASS: Reuse detection revoked the entire session family.");

    // Test 6: Explicit logout revokes the session family.
    const logoutToken = randomUUID() + randomUUID();

    await createRefreshSession(user.id, logoutToken);

    const revokedCount = await revokeRefreshSession(logoutToken);

    assert.equal(revokedCount, 1);

    console.log("PASS: Refresh session revoked during logout.");

    // A token revoked through logout must not trigger reuse detection.
    const loggedOutTokenReuse = await rotateRefreshSession(logoutToken);

    assert.equal(loggedOutTokenReuse, null);

    console.log(
      "PASS: Logged-out refresh token rejected without reuse detection.",
    );

    // Test 7: Inactive users cannot rotate refresh sessions.
    const inactiveToken = randomUUID() + randomUUID();

    await createRefreshSession(user.id, inactiveToken);

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const inactiveRotation = await rotateRefreshSession(inactiveToken);

    assert.equal(inactiveRotation, null);

    console.log("PASS: Inactive user cannot refresh session.");

    console.log("\nAll refresh-session tests passed.");
  } catch (error) {
    console.error("\nRefresh-session tests failed:", error);
    process.exitCode = 1;
  } finally {
    // Delete the temporary user and associated sessions.
    if (userId) {
      await prisma.user
        .delete({
          where: { id: userId },
        })
        .catch((error) => {
          console.error("Test-user cleanup failed:", error);
          process.exitCode = 1;
        });
    }

    await prisma.$disconnect();
  }
}

testRefreshSessions();
