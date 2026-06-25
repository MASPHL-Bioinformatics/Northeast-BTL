const inputFile = document.getElementById('inputFile');
const downloadButton = document.getElementById('downloadButton');
const previewField = document.getElementById('previewField');
const checkboxContainer = document.getElementById('checkboxContainer');

let processedBlob = null;
let originalFilename = '';

let currentText = '';
let currentQualifiers = [];
let columnState = {};

inputFile.addEventListener('change', async (event) => {
	const file = event.target.files[0];
	if (!file) return;

	originalFilename = file.name;

	// read file as text
	const text = await file.text();
	currentText = text;

	// process file
	currentQualifiers = retrieveSourceQualifiers(text);

	// initialize all columns ON by default
	const baseFields = ["name", "length", "authors", "title"];

	columnState = {};
	for (const q of currentQualifiers) columnState[q] = true;
	for (const f of baseFields) columnState[f] = true;
	columnState["collection_date_clean"] = true;
	columnState["collection_date_string_excel"] = true;
	columnState["collection_date_clean_string_excel"] = true;

	// update UI
	renderCheckboxes(currentQualifiers);
	regenerateOutput();
});

function renderCheckboxes(sourceQualifiers) {
	const boldFields = new Set([
		"name", "length", "geo_loc_name", "host",
		"collection_date", "collection_date_clean", "collection_date_string_excel",
		"collection_date_clean_string_excel", "authors", "title", "note"
	]);

	checkboxContainer.innerHTML = '';

	const baseFields = ["name", "length", "authors", "title"];

	const allFields = [
		...baseFields,
		...sourceQualifiers,
		"collection_date_clean",
		"collection_date_string_excel",
		"collection_date_clean_string_excel"
	].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

	// select/deselect all checkbox
	const masterLabel = document.createElement('label');
	masterLabel.style.display = 'block';
	masterLabel.style.fontFamily = 'verdana';
	masterLabel.style.fontSize = '90%';
	masterLabel.style.textDecoration = 'underline';

	const masterCheckbox = document.createElement('input');
	masterCheckbox.type = 'checkbox';

	const allChecked = allFields.every(f => columnState[f] !== false);
	const noneChecked = allFields.every(f => columnState[f] === false);

	masterCheckbox.checked = allChecked;
	masterCheckbox.indeterminate = !allChecked && !noneChecked;

	masterCheckbox.addEventListener('change', () => {
		const newState = masterCheckbox.checked;

		allFields.forEach(f => {
			columnState[f] = newState;
		});

		renderCheckboxes(sourceQualifiers);
		regenerateOutput();
	});

	masterLabel.appendChild(masterCheckbox);
	masterLabel.appendChild(document.createTextNode(' SELECT/DESELECT ALL'));
	checkboxContainer.appendChild(masterLabel);

	// individual checkboxes
	allFields.forEach(q => {
		const label = document.createElement('label');
		label.style.display = 'block';
		label.style.fontFamily = 'verdana';
		label.style.fontSize = '90%';
		if (boldFields.has(q)) {
			label.style.fontWeight = 'bold';
		}

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = q;
		checkbox.checked = columnState[q] ?? true;

		checkbox.addEventListener('change', () => {
			columnState[q] = checkbox.checked;
			renderCheckboxes(sourceQualifiers);
			regenerateOutput();
		});

		label.appendChild(checkbox);
		label.appendChild(document.createTextNode(' ' + q));

		checkboxContainer.appendChild(label);
	});
}

function regenerateOutput() {
	if (!currentText) return;

	const activeQualifiers = currentQualifiers.filter(q => columnState[q]);

	const includeCleanDate = columnState["collection_date_clean"];
	const includeExcelDate = columnState["collection_date_string_excel"];
	const includeCleanExcelDate = columnState["collection_date_clean_string_excel"];

	const genbankText = genbankToMetadataTable(
		currentText,
		activeQualifiers,
		includeCleanDate,
		includeExcelDate,
		includeCleanExcelDate,
		columnState
	);

	const previewGenbankText =
		retrieveFirstLines(genbankText, 6) + "\nand so on...";

	processedBlob = new Blob([genbankText], {
		type: 'text/plain'
	});

	downloadButton.disabled = false;
	previewField.value = previewGenbankText;
}

downloadButton.addEventListener('click', () => {
	if (!processedBlob) return;

	const url = URL.createObjectURL(processedBlob);

	const a = document.createElement('a');
	a.href = url;
	a.download = `${originalFilename}_metadata_table.txt`;
	document.body.appendChild(a);
	a.click();
	a.remove();

	URL.revokeObjectURL(url);
});

function retrieveFirstLines(text, numberLines) {
    return text.split(/\r?\n/).slice(0, numberLines).join('\n');
}

function dateAsStringForExcel(dateText) {
    return "=\"" + dateText + "\"";
}

function cleanDate(date) {
  const MONTHS = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  let year = "XXXX";
  let month = "XX";
  let day = "XX";

  date = date.trim();
  
  // empty input date
  if (date === "") {
    return "XXXX-XX-XX";
  }

  // YYYY-MM-DD
  let match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // YYYY-MM
  match = date.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-XX`;
  }

  // DD-Mon-YYYY
  match = date.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    day = match[1].padStart(2, "0");
    month = MONTHS[match[2]];
    year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Mon-YYYY
  match = date.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    month = MONTHS[match[1]];
    year = match[2];
    return `${year}-${month}-XX`;
  }

  // YYYY
  match = date.match(/^(\d{4})$/);
  if (match) {
    year = match[1];
    return `${year}-XX-XX`;
  }

  return `${year}-${month}-${day}`;
}

function retrieveSourceQualifiers(genbankText) {
    const qualifiers = new Set([
        "collection_date",
        "note"
    ]);

    let inSource = false;

    const lines = genbankText.split(/\r?\n/);

    for (const line of lines) {

        // feature line
        const featureMatch = line.match(/^ {5}(\S+)/);
        if (featureMatch) {
            inSource = featureMatch[1] === "source";
            continue;
        }

        if (!inSource) {
            continue;
        }

        // qualifier line
        const qualifierMatch = line.match(/^\s+\/([A-Za-z0-9_]+)/);
        if (qualifierMatch) {
            qualifiers.add(qualifierMatch[1]);
        }
    }

    return [...qualifiers].sort();
}

function genbankToMetadataTable(genbankText, activeQualifiers, includeCleanDate = true, includeExcelDate = true, includeCleanExcelDate = true, includeColumnState = {}) {
    const DELIMITER = "\t";
    const NEWLINE = "\n";

    const output = [];

    const activeColumns = {
		name: includeColumnState["name"],
		length: includeColumnState["length"],
		authors: includeColumnState["authors"],
		title: includeColumnState["title"]
	};
	
	const header = [
		"accession",
		...(activeColumns.name ? ["name"] : []),
		...(activeColumns.length ? ["length"] : []),
		...activeQualifiers,
		...(includeCleanDate ? ["collection_date_clean"] : []),
		...(includeExcelDate ? ["collection_date_string_excel"] : []),
		...(includeCleanExcelDate ? ["collection_date_clean_string_excel"] : []),
		...(activeColumns.authors ? ["authors"] : []),
		...(activeColumns.title ? ["title"] : [])
	];
	output.push(header.join(DELIMITER));

    let accession = "";
    let name = "";
    let length = "";
    let collection_date = "";
    let authors = "";
    let authorsContinuing = false;
    let title = "";
    let titleContinuing = false;
    
    let qualifierValues = {};
	for (const qualifier of activeQualifiers) {
		qualifierValues[qualifier] = "";
	}
	
	let inSource = false;
	let continuingQualifier = null;

    function writeCurrentEntry() {
        if (!accession) {
            return;
        }

        output.push([
			accession,
			...(activeColumns.name ? [name] : []),
			...(activeColumns.length ? [length] : []),
			...activeQualifiers.map(q => qualifierValues[q]),
			...(includeCleanDate ? [cleanDate(qualifierValues["collection_date"] || collection_date)] : []),
			...(includeExcelDate ? [dateAsStringForExcel(qualifierValues["collection_date"] || collection_date)] : []),
			...(includeCleanExcelDate ? [dateAsStringForExcel(cleanDate(qualifierValues["collection_date"] || collection_date))] : []),
			...(activeColumns.authors ? [authors] : []),
			...(activeColumns.title ? [title] : [])
		].join(DELIMITER));
    }

    const lines = genbankText.split(/\r?\n/);

    for (const line of lines) {

        // start of new entry
        if (/LOCUS       /.test(line)) {

            writeCurrentEntry();

            accession = "";
            name = "";
            length = "";
            authors = "";
            title = "";
            
            qualifierValues = {};
			for (const qualifier of activeQualifiers) {
				qualifierValues[qualifier] = "";
			}
			
			inSource = false;
			continuingQualifier = null;
            authorsContinuing = false;
            titleContinuing = false;
        }

        // length
        let match = line.match(/LOCUS.+ (\d+ bp)/);
        if (match) {
            length = match[1];
        }

        // accession
        match = line.match(/VERSION     (.*)$/);
        if (match) {
            accession = match[1];
        }

        // name
        match = line.match(/DEFINITION  (.*)$/);
        if (match) {
            name = match[1];
        }

        // authors
        match = line.match(/  AUTHORS   (.*)/);
        if (match) {
            if (authors) {
                authors += "; ";
            }
            authors += match[1];
            authorsContinuing = true;
        }
        else if (authorsContinuing) {
            match = line.match(/            (.*)/);
            if (match) {
                authors += " " + match[1];
            } else {
                authorsContinuing = false;
            }
        }

        // title
        match = line.match(/  TITLE     (.*)/);
        if (match) {
            if (match[1] !== "Direct Submission") {
                if (title) {
                    title += "; ";
                }
                title += match[1];
                titleContinuing = true;
            }
        }
        else if (titleContinuing) {
            match = line.match(/            (.*)/);
            if (match) {
                title += " " + match[1];
            } else {
                titleContinuing = false;
            }
        }
        
        // feature start
		match = line.match(/^ {5}(\S+)/);
		if (match) {
			inSource = match[1] === "source";
			continuingQualifier = null;
		}
		
		if (inSource) {
		
			// bare qualifier
			match = line.match(/^\s+\/([A-Za-z0-9_]+)\s*$/);
		
			if (match) {
				const qualifier = match[1];
		
				if (qualifier in qualifierValues) {
					qualifierValues[qualifier] = "true";
				}
			}
		
			// qualifier with value
			else if ((match = line.match(/^\s+\/([^=]+)="(.*?)"?$/))) {
		
				const qualifier = match[1];
				
				if (qualifier == "collection_date") {
					collection_date = match[2];
				}
		
				if (qualifier in qualifierValues) {
					qualifierValues[qualifier] = match[2];
		
					if (line.trimEnd().endsWith('"')) {
						continuingQualifier = null;
					} else {
						continuingQualifier = qualifier;
					}
				}
			}
		
			// qualifier continuation
			else if (continuingQualifier) {
		
				const contMatch = line.match(/^\s+([^\/].*?)"?$/);
		
				if (contMatch) {
					qualifierValues[continuingQualifier] += " " + contMatch[1];
		
					if (line.trimEnd().endsWith('"')) {
						continuingQualifier = null;
					}
				} else {
					continuingQualifier = null;
				}
			}
		}
	}

    // print last entry
    writeCurrentEntry();

    return output.join(NEWLINE);
}