const DB_NAME = "AxisExtensions";
const STORE_NAME = "extensions";

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME, {
                keyPath: "id"
            });
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);
    });
}

async function fileToText(file) {
    return await file.text();
}

async function fileToBase64(file) {
    return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function showToast(message, type = "success") {
    const existing = document.querySelector(".axis-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "axis-toast";

    const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
    const color = type === "success" ? "#10b981" : "#ef4444";

    Object.assign(toast.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "9999",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 22px",
        background: "rgba(5,5,7,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        color: "#FFFFFF",
        fontSize: "13px",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: "400",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        animation: "axisToastIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        pointerEvents: "auto"
    });

    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color};font-size:15px;"></i><span>${message}</span>`;

    if (!document.getElementById("axis-toast-styles")) {
        const style = document.createElement("style");
        style.id = "axis-toast-styles";
        style.textContent = `
            @keyframes axisToastIn {
                from { opacity: 0; transform: translateY(12px) scale(0.96); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes axisToastOut {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to   { opacity: 0; transform: translateY(8px) scale(0.96); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "axisToastOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function importExtension(files) {
    let manifest = null;

    const extension = {
        id: "",
        manifest: null,
        files: {}
    };

    for (const file of files) {
        const path = file.webkitRelativePath.split("/").slice(1).join("/");

        if (path === "manifest.json") {
            manifest = JSON.parse(await file.text());
            extension.manifest = manifest;
            extension.id = manifest.id;
        }

        if (file.type.startsWith("image/")) {
            extension.files[path] = {
                type: file.type,
                data: await fileToBase64(file)
            };
        } else {
            extension.files[path] = {
                type: file.type || "text/plain",
                data: await fileToText(file)
            };
        }
    }

    if (!manifest)
        throw new Error("manifest.json not found");

    if (!manifest.id)
        throw new Error("Extension ID missing from manifest");

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(extension);

    console.log("[Axis] Stored extension:", extension.id);

    return new Promise(resolve => {
        tx.oncomplete = () => {
            console.log("[Axis] Installed:", manifest.name);
            resolve(extension);
        };
    });
}

document
    .getElementById("folderPicker")
    .addEventListener("change", async e => {
        try {
            const result = await importExtension(e.target.files);
            showToast(`${result.manifest.name} installed`, "success");
        } catch (err) {
            console.error("[Axis] Extension import error:", err);
            showToast(err.message, "error");
        }
    });

async function getExtension(extensionId) {
    const db = await openDB();
    return new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(extensionId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

async function getExtensionFile(extensionId, filename) {
    const extension = await getExtension(extensionId);
    if (!extension) {
        console.error("[Axis] Extension not found:", extensionId);
        return null;
    }
    return extension.files[filename]?.data ?? null;
}

async function buildExtensionPage(extensionId, filename) {
    const extension = await getExtension(extensionId);
    if (!extension) return null;

    let html = extension.files[filename]?.data;
    if (!html) return null;

    const runtime = `
window.axis = {

    tabs: {

        executeScript(code) {

            return new Promise(resolve => {

                const id = Math.random().toString(36).slice(2);

                function listener(event) {

                    if (
                        event.data?.type === "axis-response" &&
                        event.data.id === id
                    ) {

                        window.removeEventListener("message", listener);

                        resolve(event.data.result);

                    }

                }

                window.addEventListener("message", listener);

                window.parent.postMessage({
                    type: "axis-execute-script",
                    id,
                    code
                }, "*");

            });

        }

    }

};
`;

    html = html.replace(
        "</head>",
        `<script>${runtime}<\/script></head>`
    );

    // Replace CSS files
    html = html.replace(
        /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi,
        (match, path) => {
            const file = extension.files[path];
            if (!file) return match;
            return `<style>${file.data}</style>`;
        }
    );

    // Replace JavaScript files
    html = html.replace(
        /<script\s+src=["']([^"']+)["']\s*><\/script>/gi,
        (match, path) => {
            const file = extension.files[path];
            if (!file) return match;
            return `<script>${file.data}<\/script>`;
        }
    );

    // Replace images
    html = html.replace(
        /src=["']([^"']+)["']/gi,
        (match, path) => {
            const file = extension.files[path];
            if (!file || !file.type.startsWith("image/")) return match;
            return `src="${file.data}"`;
        }
    );

    return html;
}

async function setExtensionEnabled(id, enabled) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(id);
    req.onsuccess = () => {
        const extension = req.result;
        if (!extension) return;
        extension.enabled = enabled;
        store.put(extension);
    };

    return new Promise(resolve => {
        tx.oncomplete = resolve;
    });
}