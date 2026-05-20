use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tray {
    pub id: String,
    pub name: String,
    pub state: TrayState,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrayState {
    Active,
    NeedsAttention,
    Completed,
    Archived,
}

impl TrayState {
    pub fn as_db_value(self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::NeedsAttention => "Needs attention",
            Self::Completed => "Completed",
            Self::Archived => "Archived",
        }
    }

    pub fn from_db_value(value: &str) -> Result<Self, String> {
        match value {
            "Active" => Ok(Self::Active),
            "Needs attention" => Ok(Self::NeedsAttention),
            "Completed" => Ok(Self::Completed),
            "Archived" => Ok(Self::Archived),
            _ => Err(format!("unknown tray state: {value}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewTray {
    pub name: String,
}
