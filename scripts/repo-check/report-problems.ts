export function reportProblems(problems: string[], checked: string): never {
    problems.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    for (const problem of problems) {
        console.error(problem);
    }
    console.log(`${checked} checked, ${problems.length} problems`);
    process.exit(problems.length > 0 ? 1 : 0);
}
