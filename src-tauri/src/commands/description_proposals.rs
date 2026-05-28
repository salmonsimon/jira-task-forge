use tauri::State;

use crate::models::{
    AssistedDescriptionProposal, AssistedDescriptionProposalSection,
    AssistedDescriptionProposalStatus, DescriptionProposalLogEntry, DescriptionSectionStatus,
    NewAssistedDescriptionProposal,
};
use crate::services::AppServices;

#[tauri::command]
pub fn create_assisted_description_proposal(
    services: State<'_, AppServices>,
    task_id: String,
    title: Option<String>,
    summary: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    user_comment: Option<String>,
    sections: Vec<AssistedDescriptionProposalSection>,
) -> Result<AssistedDescriptionProposal, String> {
    services
        .create_assisted_description_proposal(NewAssistedDescriptionProposal {
            task_id,
            title,
            summary,
            provider,
            model,
            user_comment,
            sections,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_assisted_description_proposals(
    services: State<'_, AppServices>,
    task_id: String,
) -> Result<Vec<AssistedDescriptionProposal>, String> {
    services
        .list_assisted_description_proposals(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_description_proposal_log(
    services: State<'_, AppServices>,
    task_id: String,
) -> Result<Vec<DescriptionProposalLogEntry>, String> {
    services
        .list_description_proposal_log(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_assisted_description_proposal_section(
    services: State<'_, AppServices>,
    proposal_id: String,
    section_id: String,
    proposed_content: Option<String>,
    status: Option<DescriptionSectionStatus>,
    reviewer_comment: Option<String>,
    apply_to_task_description: bool,
) -> Result<Option<AssistedDescriptionProposal>, String> {
    services
        .update_assisted_description_proposal_section(
            &proposal_id,
            &section_id,
            proposed_content.as_deref(),
            status,
            reviewer_comment.as_deref(),
            apply_to_task_description,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn transition_assisted_description_proposal(
    services: State<'_, AppServices>,
    proposal_id: String,
    status: AssistedDescriptionProposalStatus,
    reviewer_comment: Option<String>,
    apply_to_task_description: bool,
) -> Result<Option<AssistedDescriptionProposal>, String> {
    services
        .transition_assisted_description_proposal(
            &proposal_id,
            status,
            reviewer_comment.as_deref(),
            apply_to_task_description,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_assisted_description_proposal(
    services: State<'_, AppServices>,
    proposal_id: String,
) -> Result<bool, String> {
    services
        .delete_assisted_description_proposal(&proposal_id)
        .map_err(|error| error.to_string())
}
