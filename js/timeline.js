// js/timeline.js - Sequential Timeline Engine Supporting Decimals & Flexible Schemas
class CampaignTimeline {
  constructor(containerId, detailId, titleNavId) {
    this.container = document.getElementById(containerId);
    this.detailContainer = document.getElementById(detailId);
    this.titleContainer = document.getElementById(titleNavId);
    this.timelineData = [];
    this.currentIndex = 0;
  }

  async init(jsonPath) {
    try {
      const response = await fetch(jsonPath);
      const data = await response.json();
      
      // Explicitly sort using mathematical subtraction—handles integers and decimals (e.g., 1.2, 1.25) perfectly!
      this.timelineData = data.sort((a, b) => Number(a.timeline_order) - Number(b.timeline_order));
      
      if (this.timelineData.length > 0) {
        this.renderTimeline();
        this.selectItem(0);
      }
    } catch (error) {
      console.error("Error building the shared world timeline:", error);
    }
  }

  renderTimeline() {
    this.container.innerHTML = "";
    
    this.timelineData.forEach((item, index) => {
      // 1. Structural Date Markers: Drawn BEFORE the node if a new date string is encountered
      if (item.date_marker && item.date_marker.trim() !== "") {
        const dateDivider = document.createElement("div");
        dateDivider.className = "timeline-date-divider";
        dateDivider.innerHTML = `
          <span class="date-label">${item.date_marker}</span>
          <div class="vertical-line"></div>
        `;
        this.container.appendChild(dateDivider);
      }

      // 2. Interactive Event Node
      const nodeWrapper = document.createElement("div");
      nodeWrapper.className = `timeline-node ${this.currentIndex === index ? 'active' : ''}`;
      nodeWrapper.id = `node-${index}`;
      
      // Fallback color if none specified in the row matrix database
      const dotColor = item.color || '#94a3b8';
      
      nodeWrapper.innerHTML = `
        <div class="node-title-bubble">${item.title}</div>
        <button class="node-dot" style="--dot-color: ${dotColor}" onclick="timeline.selectItem(${index})"></button>
      `;
      this.container.appendChild(nodeWrapper);

      // 3. Dynamic Vector Vector Track: Rendered between nodes matching color changes via linear blends
      if (index < this.timelineData.length - 1) {
        const nextItem = this.timelineData[index + 1];
        const connector = document.createElement("div");
        connector.className = "timeline-connector-line";
        
        const startColor = dotColor;
        const endColor = nextItem.color || '#94a3b8';
        connector.style.background = `linear-gradient(90deg, ${startColor}, ${endColor})`;
        
        this.container.appendChild(connector);
      }
    });
  }

  selectItem(index) {
    if (index < 0 || index >= this.timelineData.length) return;
    
    document.querySelectorAll('.timeline-node').forEach(el => el.classList.remove('active'));
    
    this.currentIndex = index;
    const activeNode = document.getElementById(`node-${index}`);
    if (activeNode) activeNode.classList.add('active');

    const item = this.timelineData[index];
    
    // 4. Central Header Control Area with Arrow Shifting Keys
    this.titleContainer.innerHTML = `
      <button class="nav-arrow left" onclick="timeline.selectItem(${index - 1})" ${index === 0 ? 'disabled' : ''}>&larr;</button>
      <h2 class="current-item-title">${item.title} <span class="order-tag">[#${item.timeline_order}]</span></h2>
      <button class="nav-arrow right" onclick="timeline.selectItem(${index + 1})" ${index === this.timelineData.length - 1 ? 'disabled' : ''}>&rarr;</button>
    `;

    this.renderDetails(item);
    
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  renderDetails(item) {
    // Elegant fallbacks check if keys exist without needing explicit placeholder text fields
    const descriptionText = item.description || "No description logged for this event.";
    
    if (item.type === "recap") {
      this.detailContainer.innerHTML = `
        <div class="detail-card recap-mode">
          <span class="badge recap-badge">Session Recap</span>
          <p class="summary-text">${descriptionText}</p>
          \${item.recap_id ? `<a href="/session-recaps.html?id=\${item.recap_id}" class="recap-link-btn">Read Full Chronicles</a>` : ''}
        </div>
      `;
    } else if (item.type === "discord_vote") {
      this.detailContainer.innerHTML = `
        <div class="detail-card discord-mode">
          <span class="badge discord-badge">Discord Server Council Vote</span>
          <p class="summary-text">${descriptionText}</p>
        </div>
      `;
    } else {
      this.detailContainer.innerHTML = `
        <div class="detail-card standard-mode">
          <span class="badge event-badge">World Event</span>
          <p class="summary-text">${descriptionText}</p>
        </div>
      `;
    }
  }
}
