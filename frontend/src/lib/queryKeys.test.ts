// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { describe, expect, it } from "vitest";
import {
  recitationKeys,
  roomKeys,
  sessionKeys,
  userKeys,
} from "./queryKeys";

describe("queryKeys", () => {
  it("produces stable tuples for the same args", () => {
    expect(roomKeys.detail("abc")).toEqual(roomKeys.detail("abc"));
    expect(roomKeys.list({ search: "", active: "all", role: "x" })).toEqual(
      roomKeys.list({ search: "", active: "all", role: "x" }),
    );
  });

  it("namespaces correctly under the domain", () => {
    expect(roomKeys.detail("abc")[0]).toBe("rooms");
    expect(sessionKeys.detail("xyz")[0]).toBe("sessions");
    expect(recitationKeys.list({ session: "s" })[0]).toBe("recitations");
    expect(userKeys.studentRecitations("u")[0]).toBe("users");
  });

  it("includes the id in detail keys", () => {
    const k = roomKeys.detail("room-123");
    expect(k).toContain("room-123");
  });

  it("scopes sub-resources under the parent", () => {
    const k = roomKeys.enrollments("room-123");
    expect(k[0]).toBe("rooms");
    expect(k).toContain("room-123");
    expect(k).toContain("enrollments");
  });
});
