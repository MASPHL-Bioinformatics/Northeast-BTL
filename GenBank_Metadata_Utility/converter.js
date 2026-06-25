const inputFile = document.getElementById('inputFile');
const downloadButton = document.getElementById('downloadButton');
const previewField = document.getElementById('previewField');

let processedBlob = null;
let originalFilename = '';

inputFile.addEventListener('change', async (event) => {
	const file = event.target.files[0];
	if (!file) return;

	originalFilename = file.name;

	// read file as text
	const text = await file.text();

	// process file
	const sourceQualifiers = retrieveSourceQualifiers(text);
	const genbankText = genbankToMetadataTable(text, sourceQualifiers);
	const previewGenbankText = retrieveFirstLines(genbankText, 6) + "\nand so on...";

	// create a Blob containing the processed data
	processedBlob = new Blob([genbankText], {
		type: 'text/plain'
	});
	
	// update UI
	downloadButton.disabled = false;
	previewField.value = previewGenbankText;
});

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

function genbankToMetadataTable(genbankText, qualifiers) {
    const DELIMITER = "\t";
    const NEWLINE = "\n";

    const output = [];

    output.push([
        "accession",
        "name",
        "length",
        ...qualifiers,
        "collection_date_clean",
        "collection_date_string_excel",
        "authors",
        "title"
    ].join(DELIMITER));

    let accession = "";
    let name = "";
    let length = "";
    let authors = "";
    let authorsContinuing = false;
    let title = "";
    let titleContinuing = false;
    
    let qualifierValues = {};
	for (const qualifier of qualifiers) {
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
            name,
            length,
            ...qualifiers.map(q => qualifierValues[q]),
            cleanDate(qualifierValues["collection_date"] || ""),
            dateAsStringForExcel(qualifierValues["collection_date"] || ""),
            authors,
            title
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
			for (const qualifier of qualifiers) {
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