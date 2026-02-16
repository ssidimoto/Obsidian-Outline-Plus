import { Controller } from "@hotwired/stimulus"
import { get } from "@rails/request.js"

// Define loading messages outside the class for better organization
const LOADING_MESSAGES = [
  "Warming up the GPUs...",
  "Looking for A.E.S.T.H.E.T.I.C.S...",
  "Finding images you didn't know you needed...",
  "Downloading more RAM for the servers...",
  "Flipping the binary values...",
  "Invoking Yann Lecun...",
  "Looking for the Meaning of Life...",
  "Cooling down the GPUs...",
  "If a Query has no results, does it truly exist?",
  "Embracing the void...",
  "Polishing the pixels...",
  "Searching for signs of life in the servers...",
  "Plunging into Reddit's depths...",
  "Looking for the best posts you didn't know you needed...",
  "Reflecting on Life..."
];

// Connects to data-controller="infinite-scroll"
export default class extends Controller {
  static values = { 
    url: String,
    delay: { type: Number, default: 200 }, // Delay in ms before observing after connect
    // messages: { type: Array, default: [] } // Removed messages value
  }
  static targets = [ "message" ] // Target for the loading message paragraph

  connect() {
    this.isLoading = false;
    this.messageInterval = null; // Store the interval ID
    this.observedTarget = null; // Element currently observed by IO

    // Start cycling messages immediately
    //this.startMessageCycling();

    // Wait for the specified delay before setting up the observer
    this.connectTimeout = setTimeout(() => {
      this.setupObserver();
    }, this.delayValue);
  }

  disconnect() {
    // Clear timeout if controller disconnects before observer is setup
    clearTimeout(this.connectTimeout);
    // Clear the message cycling interval
    this.stopMessageCycling();

    if (this.observer) {
      this.observer.disconnect()
    }
  }

  startMessageCycling() {
    // Use the constant LOADING_MESSAGES array
    if (this.hasMessageTarget && LOADING_MESSAGES.length > 0) {
      // Clear any existing interval first
      this.stopMessageCycling(); 

      // Set the initial message immediately
      this.updateMessage(); 

      // Start the interval to change the message every X seconds
      this.messageInterval = setInterval(() => {
        this.updateMessage();
      }, 4000);
    }
  }

  stopMessageCycling() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }

  updateMessage() {
    // Use the constant LOADING_MESSAGES array
    if (this.hasMessageTarget && LOADING_MESSAGES.length > 0) {
      const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
      this.messageTarget.textContent = LOADING_MESSAGES[randomIndex];
    }
  }

  setupObserver() {
    // Ensure observer isn't setup multiple times
    if (this.observer) return;

    this.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.isLoading) {
        this.loadMore()
      }
    }, {
      threshold: 0 // Trigger as soon as any part of the target is visible
    })

    // Prefer observing the 9th cell of the latest batch (12-by-12)
    const targetCell = this.findBatchNinthCell()
    this.observedTarget = targetCell || this.element
    this.observer.observe(this.observedTarget)
  }

  async loadMore() {
    if (this.isLoading) return; // Prevent multiple loads
    this.isLoading = true;

    // Optionally stop message cycling when loading starts, although it might 
    // get replaced anyway. Let's keep it running for now.
    // this.stopMessageCycling(); 

    // Unobserve the current target while loading. 
    // We might not strictly need this if isLoading flag is checked, but it's safer.
    if (this.observer) {
      this.observer.unobserve(this.observedTarget || this.element)
    }

    if (this.hasUrlValue && this.urlValue.length > 0) {
      try {
        // Use request.js to fetch the Turbo Stream
        await get(this.urlValue, {
          responseKind: "turbo-stream"
        })
        // On success, the element is replaced by the stream, 
        // the new element's controller will connect and handle observing after its delay.
        // isLoading will be false in the new instance.
      } catch (error) {
        console.error("Failed to load more content:", error)
        // On failure, re-observe the *current* element after a delay to allow retry
        // Reset loading flag only after delay
        setTimeout(() => {
          if (this.observer) {
            this.observer.observe(this.element)
          }          
          this.isLoading = false;
        }, this.delayValue);
      }
    } else {
      // No URL, likely the end. Ensure isLoading is false.
      this.isLoading = false;
    }
  }

  // Find the 9th .grid-cell of the latest 12-item batch; if insufficient items, return null
  findBatchNinthCell() {
    const cells = document.querySelectorAll('.grid-cell')
    const count = cells.length
    if (count === 0) return null

    if (count >= 12) {
      // 9th in the last full batch (0-based index 8 in the last 12) => count - 4
      const idx = Math.max(0, count - 4)
      return cells[idx] || null
    }

    if (count >= 9) {
      // Before first full batch is reached, use the 9th overall
      return cells[8]
    }

    return null
  }
} 