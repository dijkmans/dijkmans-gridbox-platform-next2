import { db, auth } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

async function initializeDashboard() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("Niet ingelogd, omleiden...");
            window.location.href = "login.html";
            return;
        }

        console.log("Dashboard laden voor:", user.email);

        try {
            // STAP 1: Wie ben ik?
            const userSnap = await getDoc(doc(db, "users", user.email));
            if (!userSnap.exists()) throw new Error("Gebruiker niet gevonden in /users/");
            
            const userData = userSnap.data();
            console.log("Rol:", userData.role);

            // STAP 2: Wat mag ik? (Check de /roles/ collectie)
            const roleSnap = await getDoc(doc(db, "roles", userData.role));
            const permissions = roleSnap.exists() ? roleSnap.data() : { canSeeAllBoxes: false };

            // STAP 3: Sites ophalen (voor de namen zoals 'Winkel Geel')
            const sitesSnap = await getDocs(collection(db, "sites"));
            const siteMapping = {};
            sitesSnap.forEach(s => siteMapping[s.id] = s.data().name);

            // STAP 4: Boxen ophalen (SuperAdmin ziet alles, User alleen eigen customerId)
            let boxQuery;
            if (permissions.canSeeAllBoxes === true) {
                console.log("SuperAdmin-rechten: Alle boxen worden geladen.");
                boxQuery = query(collection(db, "boxes"));
            } else {
                console.log("Klant-rechten: Filteren op", userData.customerId);
                boxQuery = query(collection(db, "boxes"), where("customerId", "==", userData.customerId));
            }

            // Real-time luisteren naar veranderingen
            onSnapshot(boxQuery, (snapshot) => {
                const boxes = [];
                snapshot.forEach(doc => boxes.push({ id: doc.id, ...doc.data() }));
                renderUI(boxes, siteMapping, permissions);
            });

        } catch (err) {
            console.error("Dashboard fout:", err.message);
            document.getElementById("dashboard-content").innerHTML = `<p style='color:red'>Fout bij laden: ${err.message}</p>`;
        }
    });
}

function renderUI(boxes, siteMapping, permissions) {
    const container = document.getElementById("dashboard-content");
    if (!container) return;
    container.innerHTML = "";

    if (boxes.length === 0) {
        container.innerHTML = "<p>Geen boxen gevonden voor dit account.</p>";
        return;
    }

    // Groeperen per site
    const groups = {};
    boxes.forEach(box => {
        const siteName = siteMapping[box.siteId] || "Overige Locaties";
        if (!groups[siteName]) groups[siteName] = [];
        groups[siteName].push(box);
    });

    // Tekenen op scherm
    for (const [siteName, siteBoxes] of Object.entries(groups)) {
        const section = document.createElement("div");
        section.className = "site-section";
        section.innerHTML = `<h2 class="site-title">${siteName}</h2><div class="box-grid"></div>`;
        
        const grid = section.querySelector(".box-grid");
        siteBoxes.forEach(box => {
            const card = document.createElement("div");
            card.className = `box-card ${box.state?.status || 'offline'}`;
            card.innerHTML = `
                <div class="box-header">
                    <h3>${box.boxId || box.id}</h3>
                    <span class="status-badge">${box.state?.status || 'offline'}</span>
                </div>
                <div class="box-actions">
                    <button class="btn-open" onclick="handleOpen('${box.id}')">🔓 OPENEN</button>
                    ${permissions.canSeeCameras ? `<button class="btn-cam" onclick="viewCam('${box.id}')">📷 CAMERA</button>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(section);
    }
}

initializeDashboard();
