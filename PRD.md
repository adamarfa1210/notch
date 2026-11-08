# Product Requirements Document (PRD): Dynamic RAM Notch Clipboard Manager

## 1. Executive Summary & Vision
The objective is to develop a lightweight, background-running Windows service that creates a seamless, non-intrusive UI element resembling a dynamic notch at the top of the screen. This notch acts as a temporary staging area (buffer) for copied content and dragged files, optimizing workflow efficiency by keeping frequently used assets readily accessible without cluttering permanent storage.

## 2. Target Audience & Use Cases
Designed for power users, creators, and multitaskers who frequently transition images, text, and files between applications.
- **Visual Staging**: Quickly capture and hold up to five temporary images or screenshots for immediate pasting into chat apps or AI prompts.
- **File Handoff**: Drag and drop files from File Explorer into the notch to temporarily store them, then drag them out into target software (e.g., WhatsApp, AI chatbots, Anti Graffiti CLI).

## 3. System Architecture & Technical Specifications
- **Type**: Windows Background Application (System Tray).
- **UI Framework**: Electron or Tauri (utilizingframeless, topmost window rendered transparently to display only the notch).
- **Data Management**: Volatile RAM buffering utilizing a First-In, First-Out (FIFO) queue structure limiting storage to a maximum of five items.
- **URI Resolution**: All file types are processed as Uniform Resource Identifiers (URIs) to bypass the need for format-specific parsing.

## 4. User Flow & Interaction Model
### Phase 1: Initialization
1. The user launches the application via the Windows Start Menu.
2. The application runs silently in the background, represented by an icon in the system tray.
3. A visual representation of the 'notch' appears at the top center of the screen.

### Phase 2: Ingress (Capturing Data)
1. **Copying**: Whenever the user copies text or images to the clipboard, the application detects the MIME type.
2. **Screenshots**: Taking a screenshot triggers the same capture mechanism, treating the image as a copy action.
3. **Queueing**: The captured item's URI is placed into the first position (leftmost) of the FIFO queue. Existing items shift right.
4. **Capacity**: The queue maintains a maximum of five items.

### Phase 3: Staging (Data Management)
1. **Expansion**: The user moves the mouse pointer near the notch. The notch expands visually, displaying up to five thumbnail slots.
2. **Deletion**: Each thumbnail contains a small 'X' button on its top-right corner. Clicking this removes the item from the queue, allowing space for new entries.

### Phase 4: Egress (Using Data)
1. **Dragging Out**: The user clicks and drags a thumbnail from the expanded notch directly into the text bar or input field of another application (e.g., WhatsApp, AI chatbots).
2. **CLI Integration**: The Anti Graffiti CLI is configured to poll the application's local buffer/endpoint, allowing the user to reference staged items dynamically during prompts.

### Phase 5: Deactivation
1. **Closing**: The user accesses the system tray, right-clicks the application icon, and selects the exit command to terminate the service.