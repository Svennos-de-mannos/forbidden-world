// js/timeline.js
class CampaignTimeline {
  constructor(containerId, trackId, detailId, titleNavId) {
    this.container = document.getElementById(containerId);
    this.trackLine = document.getElementById(trackId);
    this.detailContainer = document.getElementById(detailId);
    this.titleContainer = document.getElementById(titleNavId);
    this.timelineData = [];
    this.currentIndex = 0;
  }

  async init(jsonPath) {
    try {
      const response = await fetch(jsonPath);
      const data = await response.json();
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
    const gradientStops = [];

    this.timelineData.forEach((item, index) => {
      const dotColor = item.color || '#94a3b8';
      gradientStops.push(dotColor);

      const nodeWrapper = document.createElement("div");
      nodeWrapper.className = `timeline-node-block`;
      nodeWrapper.id = `node-${index}`;
      
      let dateDividerHtml = '';
      if (item.date_marker && item.date_marker.trim() !== "") {
        dateDividerHtml = `
          <div class="timeline-absolute-divider">
            <span class="date-label">${item.date_marker}</span>
            <div class="vertical-line"></div>
          </div>
        `;
      }

      nodeWrapper.innerHTML = `
        ${dateDividerHtml}
        <div class="node-interactive-anchor">
          <div class="node-title-bubble">${item.title}</div>
          <button class="node-dot" style="--dot-color: ${dotColor}" onclick="window.timeline.selectItem(${index})"></button>
        </div>
      `;
      this.container.appendChild(nodeWrapper);
    });

    // Color gradient generation across the inner line track
    if (gradientStops.length > 1) {
      const segmentPercentage = 100 / (gradientStops.length - 1);
      const gradientString = gradientStops.map((color, idx) => `${color} ${idx * segmentPercentage}%`).join(', ');
      this.trackLine.style.background = `linear-gradient(90deg, ${gradientString})`;
    } else if (gradientStops.length === 1) {
      this.trackLine.style.background = gradientStops[0];
    }
  }

  selectItem(index) {
    if (index < 0 || index >= this.timelineData.length) return;
    
    document.querySelectorAll('.timeline-node-block').forEach(el => el.classList.remove('active'));
    
    this.currentIndex = index;
    const activeNode = document.getElementById(`node-${index}`);
    if (activeNode) activeNode.classList.add('active');

    const item = this.timelineData[index];
    
    this.titleContainer.innerHTML = `
      <button class="nav-arrow left" onclick="window.timeline.selectItem(${index - 1})" ${index === 0 ? 'disabled' : ''}>&larr;</button>
      <h2 class="current-item-title">${item.title} <span class="order-tag">[#${item.timeline_order}]</span></h2>
      <button class="nav-arrow right" onclick="window.timeline.selectItem(${index + 1})" ${index === this.timelineData.length - 1 ? 'disabled' : ''}>&rarr;</button>
    `;

    this.renderDetails(item);
    
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  renderDetails(item) {
    const descriptionText = item.description || "No description logged for this event.";
    if (item.type === "recap") {
      this.detailContainer.innerHTML = `
        <div class="detail-card recap-mode">
          <span class="badge recap-badge">Session Recap</span>
          <p class="summary-text">${descriptionText}</p>
          ${item.recap_id ? `<a href="/session-recaps.html?id=\${item.recap_id}" class="recap-link-btn">Read Full Chronicles</a>` : ''}
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
