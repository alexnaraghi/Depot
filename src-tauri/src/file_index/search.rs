use super::{FileEntry, FileIndex};
use nucleo_matcher::pattern::{AtomKind, CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher};
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SearchMode {
    Fuzzy,
    Exact,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub depot_path: String,
    pub score: u32,
    pub mod_time: u64,
}

impl FileIndex {
    /// Search with combined fuzzy score and recency bias
    pub fn search(&self, query: &str, mode: SearchMode, max_results: usize) -> Vec<SearchResult> {
        if query.is_empty() {
            return Vec::new();
        }

        let mut matcher = Matcher::new(Config::DEFAULT);
        let mut haystack_buf = Vec::new();

        // Create pattern based on mode
        let pattern = match mode {
            SearchMode::Fuzzy => {
                Pattern::parse(query, CaseMatching::Ignore, Normalization::Smart)
            }
            SearchMode::Exact => Pattern::new(
                query,
                CaseMatching::Ignore,
                Normalization::Smart,
                AtomKind::Substring,
            ),
        };

        // Current time for recency calculation
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let mut results: Vec<SearchResult> = Vec::new();

        for entry in &self.files {
            // Convert path to Utf32Str for nucleo
            haystack_buf.clear();
            let haystack = nucleo_matcher::Utf32Str::new(&entry.depot_path, &mut haystack_buf);

            if let Some(fuzzy_score) = pattern.score(haystack, &mut matcher) {
                // Apply recency bias: files modified in last 7 days get 1.5x boost
                let age_days = if entry.mod_time > 0 && now > entry.mod_time {
                    (now - entry.mod_time) / 86400
                } else {
                    u64::MAX // Unknown mod time, no boost
                };

                let recency_multiplier = if age_days < 7 { 1.5 } else { 1.0 };
                let combined_score = (fuzzy_score as f64 * recency_multiplier) as u32;

                results.push(SearchResult {
                    depot_path: entry.depot_path.clone(),
                    score: combined_score,
                    mod_time: entry.mod_time,
                });
            }
        }

        // Sort by score descending, then path ascending for stable ordering
        results.sort_by(|a, b| {
            b.score
                .cmp(&a.score)
                .then_with(|| a.depot_path.cmp(&b.depot_path))
        });

        results.truncate(max_results);
        results
    }
}
