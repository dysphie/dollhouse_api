import fs from "node:fs";
import path from "node:path";

const initialize = (db) => {

    db.pragma("foreign_keys = ON");
    
    const schema = fs.readFileSync(
        path.resolve(process.cwd(), "database", "schema.sql"),
        "utf8"
    );

    db.exec(schema);
};

export const DatabaseService = {
    initialize,
};