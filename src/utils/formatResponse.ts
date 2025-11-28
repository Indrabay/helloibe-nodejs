/**
 * Formats a model instance to replace created_by/updated_by UUIDs with user objects
 * Converts Sequelize model to plain object first to avoid circular reference errors
 */
export function formatModelWithUserRelations<T extends { created_by?: string | null; updated_by?: string | null; creator?: any; updater?: any; toJSON?: () => any }>(
  model: T
): T & { created_by?: { id: string; name: string; email: string } | null; updated_by?: { id: string; name: string; email: string } | null } {
  // Convert Sequelize model to plain object to avoid circular references
  const plainModel = (model as any)?.toJSON ? (model as any).toJSON() : model;
  const formatted = { ...plainModel } as any;
  
  // Replace created_by UUID with creator object
  if (formatted.creator) {
    formatted.created_by = {
      id: formatted.creator.id,
      name: formatted.creator.name,
      email: formatted.creator.email,
    };
    delete formatted.creator;
  } else if (formatted.created_by) {
    formatted.created_by = null;
  }
  
  // Replace updated_by UUID with updater object
  if (formatted.updater) {
    formatted.updated_by = {
      id: formatted.updater.id,
      name: formatted.updater.name,
      email: formatted.updater.email,
    };
    delete formatted.updater;
  } else if (formatted.updated_by) {
    formatted.updated_by = null;
  }
  
  return formatted;
}

/**
 * Formats an array of model instances
 * Converts Sequelize models to plain objects first to avoid circular reference errors
 */
export function formatModelsWithUserRelations<T extends { created_by?: string | null; updated_by?: string | null; creator?: any; updater?: any; toJSON?: () => any }>(
  models: T[]
): Array<T & { created_by?: { id: string; name: string; email: string } | null; updated_by?: { id: string; name: string; email: string } | null }> {
  return models.map(formatModelWithUserRelations);
}

