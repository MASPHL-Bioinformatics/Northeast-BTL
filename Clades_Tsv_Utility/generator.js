let cladeCount = 1;

updateOutputHeight();

function updateOutputHeight() {
    const cladeContainer = document.getElementById("cladeContainer");
    const output = document.getElementById("outputTextArea");

    output.style.height = cladeContainer.offsetHeight + "px";
}

document.getElementById("addCladeButton").addEventListener("click", () => {
    cladeCount++;

    const block = document.createElement("div");
    block.className = "cladeBlock";

    block.innerHTML = `
        <br><br>

        <input
            type="text"
            id="cladeNameField${cladeCount}"
            class="cladeName"
            placeholder="Clade name">

        <br>

        <textarea
            rows="5"
            style="width:100%; resize:none;"
            id="definingMutationsTextArea${cladeCount}"
            class="definingMutations"
            wrap="off"
            placeholder="Copy/paste defining mutations"></textarea>
    `;

    document.getElementById("cladeContainer").appendChild(block);
    updateOutputHeight();
});

function generateCladesTSV() {
    const NUCLEOTIDE_MUTATIONS_ONLY = true;
    const GAPS_MUTATIONS_INCLUDED = true;

    let output = "clade\tgene\tsite\talt\n";

    const clades = [];

    document.querySelectorAll(".cladeBlock").forEach(block => {
        const cladeName = block.querySelector(".cladeName").value.trim();
        const mutationsText = block.querySelector(".definingMutations").value.trim();

        clades.push({
            name: cladeName,
            mutations: mutationsText.split(/\r?\n/).filter(x => x)
        });
    });

    clades.forEach(clade => {
        clade.mutations.forEach(line => {
            const parts = line.split("\t");

            if (parts.length < 3) {
                return;
            }

            const gene = parts[0];
            const mutationsString = parts[2];

            if (NUCLEOTIDE_MUTATIONS_ONLY && gene !== "nuc") {
                return;
            }

            const mutations = mutationsString.split(", ");

            mutations.forEach(mutation => {
                const match = mutation.match(/^([\w-])(\d+)([\w-])$/);

                if (!match) {
                    console.error("Error: mutation not recognized:", mutation);
                    return;
                }

                const base = match[1];
                const site = match[2];
                const alt = match[3];

                if (!GAPS_MUTATIONS_INCLUDED && (base === "-" || alt === "-")) {
                    return;
                }

                output += `${clade.name}\t${gene}\t${site}\t${alt}\n`;
            });
        });
    });

    document.getElementById("outputTextArea").value = output;
}

document.getElementById("cladeContainer").addEventListener("input", generateCladesTSV);

document.getElementById("downloadButton").addEventListener("click", () => {
    const text = document.getElementById("outputTextArea").value;

    const blob = new Blob([text], { type: "text/tab-separated-values" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "clades.tsv";

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});
