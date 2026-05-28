use super::AppServices;
use crate::db::DbResult;
use crate::models::{
    AssistedDescriptionProposal, AssistedDescriptionProposalStatus, DescriptionProposalLogEntry,
    DescriptionSectionStatus, NewAssistedDescriptionProposal,
};
use crate::repositories::AssistedDescriptionProposalRepository;

impl AppServices {
    pub fn create_assisted_description_proposal(
        &self,
        new_proposal: NewAssistedDescriptionProposal,
    ) -> DbResult<AssistedDescriptionProposal> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).create(new_proposal)
    }

    pub fn list_assisted_description_proposals(
        &self,
        task_id: &str,
    ) -> DbResult<Vec<AssistedDescriptionProposal>> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).list_for_task(task_id)
    }

    pub fn list_description_proposal_log(
        &self,
        task_id: &str,
    ) -> DbResult<Vec<DescriptionProposalLogEntry>> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).list_log_for_task(task_id)
    }

    pub fn update_assisted_description_proposal_section(
        &self,
        proposal_id: &str,
        section_id: &str,
        proposed_content: Option<&str>,
        status: Option<DescriptionSectionStatus>,
        reviewer_comment: Option<&str>,
        apply_to_task_description: bool,
    ) -> DbResult<Option<AssistedDescriptionProposal>> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).update_section(
            proposal_id,
            section_id,
            proposed_content,
            status,
            reviewer_comment,
            apply_to_task_description,
        )
    }

    pub fn transition_assisted_description_proposal(
        &self,
        proposal_id: &str,
        status: AssistedDescriptionProposalStatus,
        reviewer_comment: Option<&str>,
        apply_to_task_description: bool,
    ) -> DbResult<Option<AssistedDescriptionProposal>> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).transition(
            proposal_id,
            status,
            reviewer_comment,
            apply_to_task_description,
        )
    }

    pub fn delete_assisted_description_proposal(&self, proposal_id: &str) -> DbResult<bool> {
        let connection = self.connection();
        AssistedDescriptionProposalRepository::new(&connection).delete(proposal_id)
    }
}
