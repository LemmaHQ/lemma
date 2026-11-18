use connectrpc::ConnectError;
use lemma_proto::lemma::v1::ErrorReason;
use uuid::Uuid;

pub(crate) fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| lemma_proto::app_error(ErrorReason::IdInvalid))
}
