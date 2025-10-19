document.getElementById('extract').onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById('status').textContent = "Extracting contacts...";
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractContacts
    }, (result) => {
        if (!result || !result[0]) return;
        const contacts = result[0].result;
        localStorage.setItem("wa_contacts", JSON.stringify(contacts));
        document.getElementById('status').textContent =
            `Extracted ${contacts.length} contacts`;
        document.getElementById('download').disabled = false;
    });
};

document.getElementById('download').onclick = () => {
    const prefix = document.getElementById('prefix').value.trim() || "Contact";
    const contacts = JSON.parse(localStorage.getItem("wa_contacts") || "[]");
    const vcf = contactsToVcf(contacts, prefix);
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: `${prefix.replace(/\s+/g, '_')}_contacts.vcf`
    });
};

// Convert JSON contacts to .vcf format
function contactsToVcf(contacts, prefix) {
    return contacts.map((c, i) => {
        const phone = c.phone.replace(/\s+/g, '');
        const name = `${prefix} ${i + 1}`;
        return `BEGIN:VCARD
VERSION:3.0
N:${name}
FN:${name}
TEL;TYPE=CELL:${phone}
END:VCARD`;
    }).join("\n\n");
}

// Extract function injected into WhatsApp Web
function extractContacts() {
    const panel = document.getElementById('pane-side');
    const phoneRegex = /^\+?\d[\d\s\-()]{5,}$/;
    const seen = new Set();
    const contacts = [];

    function extract() {
        const spans = Array.from(panel.querySelectorAll('span[title]'))
            .filter(el => phoneRegex.test(el.getAttribute('title')));
        spans.forEach(el => {
            const phone = el.getAttribute('title').trim();
            if (!seen.has(phone)) {
                seen.add(phone);
                contacts.push({ phone });
            }
        });
    }

    return new Promise(async (resolve) => {
        let lastScroll = -1;
        while (true) {
            extract();
            panel.scrollTop += 300;
            await new Promise(r => setTimeout(r, 500));
            if (panel.scrollTop === lastScroll) break;
            lastScroll = panel.scrollTop;
        }
        extract();
        resolve(contacts);
    });
}
