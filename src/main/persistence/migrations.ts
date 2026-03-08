import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (project_id, number)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS chapter_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        plot_number INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        rich_text_doc_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS chapter_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (source_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS chapter_documents (
        id TEXT PRIMARY KEY,
        chapter_node_id TEXT NOT NULL UNIQUE,
        content_json TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (chapter_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_plots_project_id ON plots(project_id);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON chapter_nodes(project_id);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_nodes_plot_block ON chapter_nodes(project_id, plot_number, block_number);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_edges_project_id ON chapter_edges(project_id);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_documents_node_id ON chapter_documents(chapter_node_id);
      `,
    ],
  },
  {
    version: 2,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS codex_settings (
        project_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS codex_chat_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_node_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        mode TEXT CHECK(mode IN ('cli', 'fallback')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_codex_chat_project_chapter_created
      ON codex_chat_messages(project_id, chapter_node_id, created_at);
      `,
    ],
  },
  {
    version: 3,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS character_cards (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        sex TEXT NOT NULL,
        age INTEGER,
        sexual_orientation TEXT NOT NULL,
        species TEXT NOT NULL,
        hair_color TEXT NOT NULL,
        bald INTEGER NOT NULL DEFAULT 0,
        beard TEXT NOT NULL,
        physique TEXT NOT NULL,
        job TEXT NOT NULL,
        notes TEXT NOT NULL,
        plot_number INTEGER NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS character_images (
        id TEXT PRIMARY KEY,
        character_card_id TEXT NOT NULL,
        image_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (character_card_id) REFERENCES character_cards(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS location_cards (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        location_type TEXT NOT NULL,
        description TEXT NOT NULL,
        notes TEXT NOT NULL,
        plot_number INTEGER NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS location_images (
        id TEXT PRIMARY KEY,
        location_card_id TEXT NOT NULL,
        image_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (location_card_id) REFERENCES location_cards(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_character_cards_project_plot
      ON character_cards(project_id, plot_number);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_character_images_card
      ON character_images(character_card_id);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_location_cards_project_plot
      ON location_cards(project_id, plot_number);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_location_images_card
      ON location_images(location_card_id);
      `,
    ],
  },
  {
    version: 4,
    statements: [
      `
      ALTER TABLE codex_settings
      ADD COLUMN provider TEXT NOT NULL DEFAULT 'codex_cli';
      `,
      `
      ALTER TABLE codex_settings
      ADD COLUMN allow_api_calls INTEGER NOT NULL DEFAULT 0;
      `,
      `
      ALTER TABLE codex_settings
      ADD COLUMN api_key TEXT;
      `,
      `
      ALTER TABLE codex_settings
      ADD COLUMN api_model TEXT NOT NULL DEFAULT 'gpt-5-mini';
      `,
    ],
  },
  {
    version: 5,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS character_chapter_links (
        character_card_id TEXT NOT NULL,
        chapter_node_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (character_card_id, chapter_node_id),
        FOREIGN KEY (character_card_id) REFERENCES character_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS location_chapter_links (
        location_card_id TEXT NOT NULL,
        chapter_node_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (location_card_id, chapter_node_id),
        FOREIGN KEY (location_card_id) REFERENCES location_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_node_id) REFERENCES chapter_nodes(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_character_chapter_links_chapter
      ON character_chapter_links(chapter_node_id);
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_location_chapter_links_chapter
      ON location_chapter_links(chapter_node_id);
      `,
    ],
  },
  {
    version: 6,
    statements: [
      `
      ALTER TABLE codex_settings
      ADD COLUMN auto_summarize_descriptions INTEGER NOT NULL DEFAULT 1;
      `,
    ],
  },
];

export function applyMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    db.transaction(() => {
      for (const statement of migration.statements) {
        db.exec(statement);
      }
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}

export function getLatestSchemaVersion(): number {
  return MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
}
