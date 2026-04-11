// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

//! Allowed Quran riwaya (reading) IDs — must match DB CHECK and frontend `QuranRiwaya`.

/// Normalize and validate a riwaya string from the API.
pub fn parse_riwaya(s: &str) -> Option<&'static str> {
    match s.trim() {
        "hafs" => Some("hafs"),
        "warsh" => Some("warsh"),
        "qalun" => Some("qalun"),
        "shubah" => Some("shubah"),
        "qunbul" => Some("qunbul"),
        "bazzi" => Some("bazzi"),
        "doori" => Some("doori"),
        "susi" => Some("susi"),
        "hisham" => Some("hisham"),
        "ibn_dhakwan" => Some("ibn_dhakwan"),
        "khalaf" => Some("khalaf"),
        "khallad" => Some("khallad"),
        "doori_kisai" => Some("doori_kisai"),
        "abu_harith" => Some("abu_harith"),
        _ => None,
    }
}
