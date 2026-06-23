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
	const genbankText = genbankToMetadataTable(text);
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

function genbankToMetadataTable(genbankText) {
    const DELIMITER = "\t";
    const NEWLINE = "\n";

    const output = [];

    output.push([
        "accession",
        "name",
        "length",
        "organism",
        "mol_type",
        "isolate",
        "db_xref",
        "metagenome_source",
        "strain",
        "isolation_source",
        "host",
        "geo_loc_name",
        "collection_date",
        "collection_date_clean",
        "collection_date_string_excel",
        "note",
        "authors",
        "title"
    ].join(DELIMITER));

    let accession = "";
    let name = "";
    let length = "";
    let organism = "";
    let mol_type = "";
    let isolate = "";
    let db_xref = "";
    let metagenome_source = "";
    let strain = "";
    let isolation_source = "";
    let host = "";
    let geo_loc_name = "";
    let collection_date = "";
    let collection_date_clean = "";
    let collection_date_string_excel = "";
    let note = "";
    let noteContinuing = false;
    let authors = "";
    let authorsContinuing = false;
    let title = "";
    let titleContinuing = false;

    function writeCurrentEntry() {
        if (!accession) {
            return;
        }

        output.push([
            accession,
            name,
            length,
            organism,
            mol_type,
            isolate,
            db_xref,
            metagenome_source,
            strain,
            isolation_source,
            host,
            geo_loc_name,
            collection_date,
            cleanDate(collection_date),
            dateAsStringForExcel(collection_date),
            note,
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
            organism = "";
            mol_type = "";
            isolate = "";
            db_xref = "";
            metagenome_source = "";
            strain = "";
            isolation_source = "";
            host = "";
            geo_loc_name = "";
            collection_date = "";
            note = "";
            authors = "";
            title = "";

            noteContinuing = false;
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

        // organism
        match = line.match(/                     \/organism="(.*)"/);
        if (match) {
            organism = match[1];
        }

        // mol_type
        match = line.match(/                     \/mol_type="(.*)"/);
        if (match) {
            mol_type = match[1];
        }
        
        // isolate
        match = line.match(/                     \/isolate="(.*)"/);
        if (match) {
            isolate = match[1];
        }
        
        // db_xref
        match = line.match(/                     \/db_xref="(.*)"/);
        if (match) {
            db_xref = match[1];
        }
        
        // metagenome_source
        match = line.match(/                     \/metagenome_source="(.*)"/);
        if (match) {
            metagenome_source = match[1];
        }

        // strain
        match = line.match(/                     \/strain="(.*)"/);
        if (match) {
            strain = match[1];
        }

        // isolation_source
        match = line.match(/                     \/isolation_source="(.*)"/);
        if (match) {
            isolation_source = match[1];
        }

        // host
        match = line.match(/                     \/host="(.*)"/);
        if (match) {
            host = match[1];
        }

        // geo_loc_name
        match = line.match(/                     \/geo_loc_name="(.*)"/);
        if (match) {
            geo_loc_name = match[1];
        }

        // collection_date
        match = line.match(/                     \/collection_date="(.*)"/);
        if (match) {
            collection_date = match[1];
        }

        // note
        match = line.match(/                     \/note="(.*?)"?$/);
        if (match) {
            note = match[1];
            noteContinuing = true;
        }
        else if (noteContinuing) {
            match = line.match(/                     ([^"\/].*?)"?$/);
            if (match) {
                note += " " + match[1];
            } else {
                noteContinuing = false;
            }
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
    }

    // print last entry
    writeCurrentEntry();

    return output.join(NEWLINE);
}