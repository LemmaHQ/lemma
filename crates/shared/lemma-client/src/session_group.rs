use std::cmp::Reverse;

use chrono::{DateTime, TimeZone, Utc};
use lemma_proto::lemma::v1::Session;

/// The calendar-day bucket in which a session was last updated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionPeriod {
    /// Today or a future calendar day.
    Today,
    /// The previous calendar day.
    Yesterday,
    /// Two through six calendar days ago.
    PreviousSevenDays,
    /// Seven or more days ago, or a session without an update time.
    Earlier,
}

/// Sessions in one calendar-day bucket, most recently updated first.
#[derive(Debug)]
pub struct SessionGroup<'list> {
    /// The bucket shared by these sessions.
    pub period: SessionPeriod,
    /// The sessions in this bucket.
    pub sessions: Vec<&'list Session>,
}

/// Groups sessions by whole calendar-day distance from `now` in its time zone.
#[must_use]
pub fn group_sessions<'list, Tz: TimeZone>(
    sessions: &'list [Session],
    now: &DateTime<Tz>,
) -> Vec<SessionGroup<'list>> {
    let mut dated: Vec<(&Session, Option<DateTime<Utc>>)> = sessions
        .iter()
        .map(|session| {
            let updated = session
                .updated_at
                .as_option()
                .and_then(|timestamp| DateTime::<Utc>::try_from(timestamp.clone()).ok());
            (session, updated)
        })
        .collect();
    dated.sort_by_key(|entry| Reverse(entry.1));

    let mut grouped: [Vec<&Session>; 4] = [Vec::new(), Vec::new(), Vec::new(), Vec::new()];
    for (session, updated) in dated {
        let Some(updated) = updated else {
            grouped[3].push(session);
            continue;
        };
        let days = now
            .date_naive()
            .signed_duration_since(updated.with_timezone(&now.timezone()).date_naive())
            .num_days();
        let index = match days {
            ..=0 => 0,
            1 => 1,
            2..=6 => 2,
            _ => 3,
        };
        grouped[index].push(session);
    }

    [
        SessionPeriod::Today,
        SessionPeriod::Yesterday,
        SessionPeriod::PreviousSevenDays,
        SessionPeriod::Earlier,
    ]
    .into_iter()
    .zip(grouped)
    .filter_map(|(period, sessions)| {
        if sessions.is_empty() {
            None
        } else {
            Some(SessionGroup { period, sessions })
        }
    })
    .collect()
}
