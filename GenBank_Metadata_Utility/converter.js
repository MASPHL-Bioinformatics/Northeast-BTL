const inputFile = document.getElementById('inputFile');
const downloadButton = document.getElementById('downloadButton');

let processedBlob = null;
let originalFilename = '';

inputFile.addEventListener('change', async (event) => {
	const file = event.target.files[0];
	if (!file) return;

	originalFilename = file.name;

	// Read file as text
	const text = await file.text();

	// Process file
	const genbankText = genbankToMetadataTable(text);

	// Create a Blob containing the processed data
	processedBlob = new Blob([genbankText], {
		type: 'text/plain'
	});

	downloadButton.disabled = false;
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
        "strain",
        "isolation_source",
        "host",
        "geo_loc_name",
        "collection_date",
        "note",
        "authors",
        "title"
    ].join(DELIMITER));

    let accession = "";
    let name = "";
    let length = "";
    let organism = "";
    let mol_type = "";
    let strain = "";
    let isolation_source = "";
    let host = "";
    let geo_loc_name = "";
    let collection_date = "";
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
            strain,
            isolation_source,
            host,
            geo_loc_name,
            collection_date,
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