// ==UserScript==
// @name         Enhanced Userscript with TTS API Integration
// @namespace    http://tampermonkey.net/
// @version      2024-11-08
// @description  Adds functionality to download text, read aloud using TTS API, and copy text with chapter end note.
// @match        https://sangtacviet.vip/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=sangtacviet.vip
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Add CSS styles for highlighting
    const style = document.createElement("style");
    style.innerHTML = `
    .full-width-container {
        width: 150px; /* Set a fixed width for the sidebar */
        height: 500px; /* Make the sidebar span the full height of the viewport */
        padding: 10px;
        background-color: #f9f9f9;
        border-right: 1px solid #ddd; /* Add a right border instead of top */
        display: flex;
        flex-direction: column; /* Align items in a column */
        align-items: center;
        gap: 10px;
        box-sizing: border-box;
        justify-content: space-evenly; /* Align items to the start of the sidebar */
        position: fixed; /* Fixes the element to the viewport */
        top: 0; /* Aligns the element to the top of the viewport */
        left: 0; /* Aligns the element to the left of the viewport */
        z-index: 1000; /* Ensures the element stays on top of other elements */
        margin-top:400px;
    }

    .highlighted {
        background-color: yellow;
    }

    .full-width-container button, .full-width-container select {
        width: 100px;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background-color: #007bff;
        color: white;
        font-size: 14px;
        transition: background-color 0.3s;
    }

    .full-width-container button:hover, .full-width-container select:hover {
        background-color: #0056b3;
    }

    .full-width-container button:active, .full-width-container select:active {
        background-color: #004494;
    }

    .full-width-container input[type="range"] {
        width: 150px;
        height: 5px;
        -webkit-appearance: none;
        background-color: #007bff;
        border-radius: 3px;
        outline: none;
        cursor: pointer;
    }

        .container {
        max-width: 1600px;
    }
`;
    document.head.appendChild(style);

    let utterance;
    let isPaused = false;
    let content = "";
    let currentPosition = 0;
    let playbackRate = 1;
    let voiceName = "";
    let isAutoPlay = false;

    // Save playbackRate and currentPosition to localStorage
    function saveToLocalStorage() {
        localStorage.setItem('playbackRate', playbackRate);
        localStorage.setItem('selectedVoice', voiceSelect.value);
        localStorage.setItem('isAutoPlay', isAutoPlay);
    }

    // Retrieve playbackRate and currentPosition from localStorage
    function loadFromLocalStorage() {
        playbackRate = localStorage.getItem('playbackRate') || 1;
        voiceName = localStorage.getItem('selectedVoice') || "";
        isAutoPlay = localStorage.getItem('isAutoPlay') || false;
        if (utterance) {
            utterance.rate = playbackRate;
        }
    }

    loadFromLocalStorage();
    document.addEventListener("DOMContentLoaded", loadFromLocalStorage);


    const container = document.createElement("div");
    container.className = "full-width-container";

    const downloadButton = document.createElement("button");
    downloadButton.innerText = "Download Text";

    const copyButton = document.createElement("button");
    copyButton.innerText = "Copy Text";

    const readAloudButton = document.createElement("button");
    readAloudButton.innerText = "Play";

    const pauseButton = document.createElement("button");
    pauseButton.innerText = "Pause";

    const stopButton = document.createElement("button");
    stopButton.innerText = "Stop";

    const progressBar = document.createElement("input");
    progressBar.type = "range";
    progressBar.min = 0;
    progressBar.max = 100;
    progressBar.value = 0;

    // Speed rate slider
    const rateSlider = document.createElement("input");
    rateSlider.type = "range";
    rateSlider.min = 0.5;
    rateSlider.max = 2;
    rateSlider.step = 0.1;
    rateSlider.value = playbackRate;
    rateSlider.title = "Adjust playback speed";

    const voiceSelect = document.createElement("select");
    const populateVoiceList = () => {
        const voices = window.speechSynthesis.getVoices().filter(v => v.lang==="vi-VN");
        voiceSelect.innerHTML = "";
        voices.forEach((voice, index) => {
            const option = document.createElement("option");
            option.value = voice.name;
            option.selected = voice.name === voiceName;
            option.text = `${voice.name.slice(10)}`;
            voiceSelect.appendChild(option);
        });
    };

    voiceSelect.addEventListener("change", saveToLocalStorage);

    // Original rerenderWithIds function
    const rerenderWithIds = (startIndex = 0) => {
        const contentBox = document.querySelector("#content-container .contentbox");
        if (contentBox) {
            const lines = contentBox.innerText.split("\n\n");
            const wordsWithBreaks = lines.flatMap((line, i) => {
                const words = line.split(" ");
                return i < lines.length - 1 ? words.concat("<br><br>") : words;
            });

            let cumulativeIndex = startIndex;
            contentBox.innerHTML = wordsWithBreaks
                .map((word) => {
                const regex = /[a-zA-Z0-9\u0400-\u04FF\u00C0-\u1EF9\s]/;
                const isWord = regex.test(word.trim()) && word !== "<br><br>";
                const wordHTML = isWord
                ? `<span id="word-${cumulativeIndex}" class="word">${word}</span>`
                            : word;

                if (isWord) {
                    cumulativeIndex += 1;
                }
                return wordHTML;
            })
                .join(" ");
        }
    };

    const highlightWordById = (index) => {
        document.querySelectorAll(".highlighted").forEach(el => el.classList.remove("highlighted"));
        const spokenWordElement = document.getElementById(`word-${index}`);
        if (spokenWordElement) {
            spokenWordElement.classList.add("highlighted");
            spokenWordElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    downloadButton.addEventListener("click", function() {
        const bookChapterName = document.querySelector("#bookchapnameholder");
        const contentBox = document.querySelector("#content-container .contentbox");
        if (contentBox) {
            const fullContent = `${bookChapterName}\n\n${contentBox.innerText}`;
            const blob = new Blob([fullContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `${bookChapterName}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    copyButton.addEventListener("click", function() {
        const bookChapterName = document.querySelector("#bookchapnameholder");
        const contentBox = document.querySelector("#content-container .contentbox");
        if (contentBox) {
            const fullContent = `${bookChapterName}\n\n${contentBox.innerText}`;
            navigator.clipboard.writeText(fullContent).then(() => {
                alert("Text copied to clipboard!");
            });
        }
    });

    const startReading = (startFrom = 0) => {
        rerenderWithIds(startFrom);

        const contentBox = document.querySelector("#content-container .contentbox");
        if (contentBox) {
            content = contentBox.innerText;
            const textToRead = content.slice(startFrom);

            utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.lang = 'vi-VN';
            utterance.rate = playbackRate;

            utterance.voice = window.speechSynthesis.getVoices().find(v => v.name.includes(voiceSelect.value));

            let wordIndex = 0;
            utterance.onboundary = (event) => {
                if (event.name === "word") {
                    highlightWordById(wordIndex);
                    wordIndex++;
                }
                currentPosition = startFrom + event.charIndex;
            };

            utterance.onend = () => {
                isAutoPlay = true;
                saveToLocalStorage();
                setTimeout(() => {
                    document.getElementById("navnextbot").click();
                }, 1000);
            };

            window.speechSynthesis.speak(utterance);
            isPaused = false;
        }
    };



    // Event listener for playback rate slider
    rateSlider.addEventListener("input", () => {
        playbackRate = rateSlider.value;
        if (utterance) {
            utterance.rate = playbackRate;
        }
        saveToLocalStorage();
    });

    // Event listener for read aloud button
    readAloudButton.addEventListener("click", () => {
        if (isPaused && utterance) {
            window.speechSynthesis.resume();
        } else {
            startReading(currentPosition);
        }
        saveToLocalStorage();
    });

    // Event listener for pause button
    pauseButton.addEventListener("click", () => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            isPaused = true;
        }
        saveToLocalStorage();
    });

    // Event listener for stop button
    stopButton.addEventListener("click", () => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            utterance = null;
            isPaused = false;
            currentPosition = 0;
            progressBar.value = 0;
            isAutoPlay = false;
        }
        saveToLocalStorage();
    });

    // Event listener for progress bar
    progressBar.addEventListener("input", () => {
        if (utterance) {
            window.speechSynthesis.cancel();
            currentPosition = Math.floor((progressBar.value / 100) * content.length);
            startReading(currentPosition);
        }
        saveToLocalStorage();
    });


    container.appendChild(downloadButton);
    container.appendChild(copyButton);
    container.appendChild(voiceSelect);
    container.appendChild(readAloudButton);
    container.appendChild(pauseButton);
    container.appendChild(stopButton);
    container.appendChild(progressBar);
    container.appendChild(rateSlider);

    document.body.appendChild(container);

    window.speechSynthesis.onvoiceschanged = populateVoiceList;

    function checkAndAutoPlay() {
        const contentBox = document.querySelector("#content-container .contentbox");

        if (contentBox && contentBox.innerText === "Nhấp vào để tải chương...") {
            if (isAutoPlay) {
                    startReading();
            }
        } else {
            // If condition is not met, check again after 1 second
            setTimeout(checkAndAutoPlay, 3000);
        }
    }

    // Call the function to start the checking process
    checkAndAutoPlay();


})();
