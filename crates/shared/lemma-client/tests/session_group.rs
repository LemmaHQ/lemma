//! Behavioral tests for session calendar grouping.

use std::error::Error;

use buffa_types::google::protobuf::Timestamp;
use chrono::{DateTime, FixedOffset, Utc};
use lemma_client::{SessionPeriod, group_sessions};
use lemma_proto::lemma::v1::Session;

fn session(id: &str, updated_at: Option<DateTime<Utc>>) -> Session {
    let mut session = Session {
        id: id.to_owned(),
        ..Default::default()
    };
    if let Some(updated_at) = updated_at {
        session.updated_at = Timestamp::from(updated_at).into();
    }
    session
}

fn utc(value: &str) -> Result<DateTime<Utc>, Box<dyn Error>> {
    Ok(DateTime::parse_from_rfc3339(value)?.with_timezone(&Utc))
}

#[test]
fn sessions_sort_into_calendar_day_groups() -> Result<(), Box<dyn Error>> {
    let now = DateTime::parse_from_rfc3339("2026-01-08T12:00:00+05:30")?;
    let sessions = vec![
        session("undated", None),
        session("six-days", Some(utc("2026-01-02T12:00:00+05:30")?)),
        session("today", Some(utc("2026-01-08T01:00:00+05:30")?)),
        session("seven-days", Some(utc("2026-01-01T12:00:00+05:30")?)),
        session("future", Some(utc("2026-01-09T01:00:00+05:30")?)),
        session("yesterday", Some(utc("2026-01-07T23:00:00+05:30")?)),
        session("two-days", Some(utc("2026-01-06T12:00:00+05:30")?)),
        Session {
            id: "invalid".to_owned(),
            updated_at: Timestamp {
                nanos: -1,
                ..Default::default()
            }
            .into(),
            ..Default::default()
        },
    ];

    let groups = group_sessions(&sessions, &now);
    let periods: Vec<_> = groups.iter().map(|group| group.period).collect();
    assert_eq!(
        periods,
        [
            SessionPeriod::Today,
            SessionPeriod::Yesterday,
            SessionPeriod::PreviousSevenDays,
            SessionPeriod::Earlier,
        ],
        "groups use fixed order"
    );
    let ids: Vec<Vec<&str>> = groups
        .iter()
        .map(|group| {
            group
                .sessions
                .iter()
                .map(|session| session.id.as_str())
                .collect()
        })
        .collect();
    assert_eq!(
        ids,
        [
            vec!["future", "today"],
            vec!["yesterday"],
            vec!["two-days", "six-days"],
            vec!["seven-days", "undated", "invalid"],
        ],
        "sessions descend by update and undated sessions finish Earlier"
    );
    Ok(())
}

#[test]
fn grouping_uses_now_timezone_and_omits_empty_groups() -> Result<(), Box<dyn Error>> {
    let now = DateTime::parse_from_rfc3339("2026-01-08T00:15:00+05:30")?;
    let sessions = vec![session("local-today", Some(utc("2026-01-07T20:00:00Z")?))];
    let groups = group_sessions(&sessions, &now);
    assert_eq!(groups.len(), 1, "only the nonempty group returned");
    assert_eq!(
        groups[0].period,
        SessionPeriod::Today,
        "local date decides bucket"
    );
    assert_eq!(groups[0].sessions[0].id, "local-today", "session retained");

    let empty: Vec<Session> = Vec::new();
    let groups = group_sessions(&empty, &now);
    assert!(groups.is_empty(), "empty input returns no groups");
    let _: &DateTime<FixedOffset> = &now;
    Ok(())
}
