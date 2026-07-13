export const applyMutatorTagFilters = (filters, where, params, runIdCol = "r.run_id") => {
    if (filters.mutators?.length) {
        const placeholders = filters.mutators.map(() => "?").join(",");

        where.push(`
            (
                SELECT COUNT(*)
                FROM run_mutators rm
                WHERE rm.run_id = ${runIdCol}
            ) = ${filters.mutators.length}
        `);

        where.push(`
            (
                SELECT COUNT(*)
                FROM run_mutators rm
                WHERE rm.run_id = ${runIdCol}
                  AND rm.mutator_id IN (${placeholders})
            ) = ${filters.mutators.length}
        `);

        params.push(...filters.mutators);
    }

    if (filters.tags?.length) {
        const placeholders = filters.tags.map(() => "?").join(",");

        where.push(`
            (
                SELECT COUNT(*)
                FROM run_perf_tags rpt
                WHERE rpt.run_id = ${runIdCol}
                  AND rpt.perf_tag_id IN (${placeholders})
            ) = ${filters.tags.length}
        `);

        params.push(...filters.tags);
    }
};