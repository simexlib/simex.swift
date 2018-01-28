var fs = require("fs");

const sourceDir = __dirname + "/../Tests/SimexTests";
const dataDir = __dirname + "/../../simex.js/test/data";

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function functionContent(json, file) {
    if (typeof json == "object") {
        if (json instanceof Array) {
            var groups = [];
            for (const j of json) {
                if (typeof j.expression === "object" && j.expression !== null) {
                    groups.push(functionContent(j, file))
                }
            }
            return groups.join('\n\n        ');
        }
    }
    else {
        throw new Error("Invalid Test Data " + file);
    }

    let experssText = JSON.stringify(json.expression);
    let escapedText = experssText
        .split("\"").join("\\\"")
        .split("\\u").join("\\\\u");

    // error
    let error = json.error;
    let at = json.at ? ("\"" + json.at + "\"") : "\"\"";

    var lines = [];
    if (typeof json.input == "string") {
        if (error) {
            lines.push("// should fail with " + experssText + " from \"" + json.input + "\", throw $" + json.error);
            lines.push("try test(\"" + escapedText + "\", input: \"" + json.input + "\", error: ." + json.error + ", at: " + at + ")");
        }
        else if (json.output !== undefined) {
            let output = JSON.stringify(json.output)


            let escapedInput = json.input
                .split("\0").join("\\u{0}")

            let escapedOutput = output
                .split("\\u0000").join("\\u{0}")
                .split("\"").join("\\\"")

            lines.push("// should extract with " + experssText + " from \"" +escapedInput + "\" to " + output);
            lines.push("try test(\"" + escapedText + "\", input: \"" + escapedInput+ "\", output: \"" + escapedOutput + "\")");
        }
    }
    else if (error) {
        lines.push("// should fail with " + experssText+ ", and throw $" + json.error);
        lines.push("try test(\"" + escapedText + "\", error: ." + json.error + ", at: " + at + ")");
    }
    else {
        lines.push("// should load with " + experssText);
        lines.push("try test(\"" + escapedText + "\")")
    }

    return lines.join("\n        ");
}

["Syntax", "Extraction"].forEach(section => {
    var dir = dataDir + "/" + section.toLowerCase();
    const items = fs.readdirSync(dir);
    var groups = [];
    var files = [];
    for (let i = 0; i < items.length; i += 1) {
        var item = items[i];
        if (!item.endsWith(".test.json")) {
            continue
        }
        let group = item.substring(item.indexOf('.') + 1, item.length - ".test.json".length).trim();
        groups.push(group);
        files.push(item);
    }

    let allTests = [];
    let functions = [];
    for (let i = 0; i < groups.length; i += 1) {
        let group = groups[i];
        let file = files[i];
        var json = JSON.parse(fs.readFileSync(dir + "/" + file, "utf8"));

        let label = "test" + group.split('.').map(str => capitalizeFirstLetter(str)).join('');
        allTests.push("(\"" + label +"\", " + label + "),");

        let content = ""
            + "    func " + label + "() throws {"
            + "\n        " + functionContent(json, file)
            + "\n    }";

        functions.push(content)
    }
    if (allTests.length > 0) {
        let last = allTests[allTests.length - 1];
        allTests[allTests.length - 1] = last.substring(0, last.length - 1);
    }

    let file = "// swiftlint:disable superfluous_disable_command line_length file_length"
        + "\nimport XCTest"
        + "\nimport Foundation"
        + "\n@testable import Simex"
        + "\n"
        + "\nclass " + section +  "Tests: XCTestCase {"
        + "\n    static let allTests = ["
        + "\n        " + allTests.join("\n        ")
        + "\n    ]"
        + "\n\n"
        + functions.join("\n\n")
        + "\n}"
        + "\n"

    fs.writeFileSync(sourceDir + "/" + section + "Tests.swift", file, "utf8")
});
