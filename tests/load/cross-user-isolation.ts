/**
 * tests/load/cross-user-isolation.ts
 *
 * STEP 7 — DATABASE CORRECTNESS & CROSS-USER ISOLATION TEST
 *
 * Verifies under concurrent writes:
 * 1. User A cannot read User B's project (RLS policy check)
 * 2. User A cannot update User B's project (RLS policy check)
 * 3. Simultaneous updates to Project A, Project B, Project C never cause cross-contamination
 * 4. Exact persisted content matches submitted content byte-for-byte
 * 5. Zero duplicate project ownership or RLS bypass
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";
import type { IsolationTestResult } from "./types";

export interface IsolationUserContext {
  userId: string;
  email: string;
  token: string;
  supabase: ReturnType<typeof createClient<Database>>;
  projectId?: string;
}

export async function runCrossUserIsolationTest(
  users: IsolationUserContext[]
): Promise<IsolationTestResult> {
  const result: IsolationTestResult = {
    passed: true,
    usersTested: users.length,
    crossUserReadsBlocked: 0,
    crossUserWritesBlocked: 0,
    dataMatchesExpected: true,
    errors: [],
  };

  if (users.length < 2) {
    result.passed = false;
    result.errors.push("Cross-user isolation test requires at least 2 distinct user sessions.");
    return result;
  }

  console.log(`\n======================================================`);
  console.log(`DATABASE CORRECTNESS & ISOLATION TEST (${users.length} Users)`);
  console.log(`======================================================\n`);

  try {
    // Phase 1: Each user creates a private project with unique content
    console.log("Phase 1: Concurrent Project Creation...");
    const creationPromises = users.map(async (u, idx) => {
      const initialContent = `<p>Confidential payload for User ${idx} (${u.userId}): ${Math.random()}</p>`;
      const { data, error } = await u.supabase
        .from("projects")
        .insert({
          name: `Isolation Test Project ${idx}`,
          content: initialContent,
          user_id: u.userId,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(`User ${idx} project creation failed: ${error.message}`);
      }
      u.projectId = data.id;
      return { userIndex: idx, projectId: data.id, content: initialContent };
    });

    const createdProjects = await Promise.all(creationPromises);
    console.log(`  ✓ All ${createdProjects.length} private projects created successfully.`);

    // Phase 2: Verify Cross-User Read Isolation (User i attempts to read User j's project)
    console.log("\nPhase 2: Cross-User Read Encroachment Verification...");
    for (let i = 0; i < users.length; i++) {
      const currentUser = users[i]!;
      const otherProject = createdProjects[(i + 1) % users.length]!;

      const { data, error } = await currentUser.supabase
        .from("projects")
        .select("*")
        .eq("id", otherProject.projectId)
        .maybeSingle();

      if (data) {
        result.passed = false;
        const err = `SECURITY VIOLATION: User ${i} read project belonging to User ${(i + 1) % users.length}!`;
        result.errors.push(err);
        console.error(`  ✗ ${err}`);
      } else {
        result.crossUserReadsBlocked++;
      }
    }
    console.log(`  ✓ Blocked ${result.crossUserReadsBlocked} unauthorized cross-user read attempts.`);

    // Phase 3: Verify Cross-User Write Encroachment (User i attempts to update User j's project)
    console.log("\nPhase 3: Cross-User Write Encroachment Verification...");
    for (let i = 0; i < users.length; i++) {
      const currentUser = users[i]!;
      const otherProject = createdProjects[(i + 1) % users.length]!;

      const { data, error } = await currentUser.supabase
        .from("projects")
        .update({ content: `<p>MALICIOUS OVERWRITE ATTEMPT BY USER ${i}</p>` } as never)
        .eq("id", otherProject.projectId)
        .select("*");

      if (data && data.length > 0) {
        result.passed = false;
        const err = `SECURITY VIOLATION: User ${i} successfully overwrote project belonging to User ${(i + 1) % users.length}!`;
        result.errors.push(err);
        console.error(`  ✗ ${err}`);
      } else {
        result.crossUserWritesBlocked++;
      }
    }
    console.log(`  ✓ Blocked ${result.crossUserWritesBlocked} unauthorized cross-user update attempts.`);

    // Phase 4: Simultaneous Concurrent Updates (A -> A2, B -> B2, C -> C2)
    console.log("\nPhase 4: Simultaneous Concurrent Legitimate Updates...");
    const updatedExpectations = new Map<string, string>();

    const updatePromises = users.map(async (u, idx) => {
      const updatedContent = `<p>Updated payload v2 for User ${idx}: ${Date.now()}_${Math.random()}</p><div class="math-block" data-latex="x_{${idx}} = \\sum_{i=1}^n i"></div>`;
      updatedExpectations.set(u.projectId!, updatedContent);

      const { data, error } = await u.supabase
        .from("projects")
        .update({
          content: updatedContent,
          page_count: idx + 1,
        } as never)
        .eq("id", u.projectId!)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Simultaneous update failed for user ${idx}: ${error.message}`);
      }
      return data;
    });

    await Promise.all(updatePromises);
    console.log("  ✓ All simultaneous updates completed.");

    // Phase 5: Byte-for-byte Content Verification
    console.log("\nPhase 5: Byte-for-Byte Persisted Content Verification...");
    for (let i = 0; i < users.length; i++) {
      const u = users[i]!;
      const expected = updatedExpectations.get(u.projectId!);

      const { data, error } = await u.supabase
        .from("projects")
        .select("content, page_count")
        .eq("id", u.projectId!)
        .single();

      if (error || !data) {
        result.passed = false;
        result.errors.push(`Failed to re-fetch project for user ${i}: ${error?.message}`);
        continue;
      }

      if (data.content !== expected) {
        result.passed = false;
        result.dataMatchesExpected = false;
        const err = `DATA CORRUPTION: Content mismatch for user ${i}! Expected: ${expected?.slice(0, 40)}... Got: ${data.content.slice(0, 40)}...`;
        result.errors.push(err);
        console.error(`  ✗ ${err}`);
      }
      if (data.page_count !== i + 1) {
        result.passed = false;
        result.dataMatchesExpected = false;
        result.errors.push(`Metadata mismatch for user ${i}: expected page_count ${i + 1}, got ${data.page_count}`);
      }
    }

    if (result.dataMatchesExpected) {
      console.log(`  ✓ 100% byte-for-byte content integrity verified across all users.`);
    }

    // Cleanup created test projects
    console.log("\nCleaning up isolation test projects...");
    await Promise.all(
      users.map(async (u) => {
        if (u.projectId) {
          await u.supabase.from("projects").delete().eq("id", u.projectId);
        }
      })
    );
    console.log("  ✓ Cleanup complete.");

  } catch (err: any) {
    result.passed = false;
    result.errors.push(`Exception during isolation test: ${err.message}`);
    console.error("Exception during isolation test:", err);
  }

  return result;
}
