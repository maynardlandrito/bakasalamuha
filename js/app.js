let deferredPrompt;
let usingApp = window.matchMedia('(display-mode: standalone)').matches;
let alreadyInstalled = true;
let bks = {};
let cacheName = 'bks-assets';
let db = null;
let dbVersion = 1;
let dbName = 'bks_db'
let contactList = [];
let video = null;
let snapshotCanvas = null;
let snapshotContext = null;
let qrcodeWorker = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  alreadyInstalled = false;
  bks.showInstallButton();
})

window.addEventListener('appinstalled', (e) => {
  alreadyInstalled = true;
  $('#install-button').addClass('hidden');
});

$(document).ready(() => {
  bks = new function(){
    this.init = () => {
      this.log('init');
      this.registerServiceWorker();
      this.showInstallButton();
      this.initQrScanner();
      this.initListeners();
      this.initDb();
    }

    this.registerServiceWorker = () => {
      let showUpdate = false;
      if ('serviceWorker' in navigator) {
        this.log('registration init');
        caches.has(cacheName).then((cachePresent) => {
          this.log('cache check');
          if(cachePresent) {
            this.log('cache found');
            showUpdate = true;
          }

          this.log('register code start');
          navigator.serviceWorker
            .register(`${self.location.pathname}service-worker.js`)
            .then((registration) => {
              this.log('register finish');
              console.log('service worker registered');
              this.log(`online status: ${navigator.onLine ? 'online' : 'offline'}`);
            })
            .catch((err) => {
              console.log('service worker not registered', err);
              this.log('error registering service worker');
            })
        });
      }
    };

    this.showInstallButton = () => {
      if(!usingApp && !alreadyInstalled && $('#update-button').hasClass('hidden')) {
        $('#install-button').removeClass('hidden');
        $('.tab-content-container').addClass('tab-content-additional-padding');
        $('#install-button').on('click', (e) => {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
            } else {
              console.log('User dismissed the install prompt');
            }
          });
        });
      }
    };

    this.showUpdateButton = () => {
      $('#install-button').addClass('hidden');
      $('#update-button').removeClass('hidden');
      $('#update-button').on('click', (e) => {
        location.reload(true);
      });
    };

    this.initListeners = () => {
      $('.add-contact-tab').on('click', () => {
        $('.container').removeClass('yellow-bg blue-bg red-bg');
        $('.container').addClass('yellow-bg');
        $('.tab').removeClass('selected-tab');
        $('.add-contact-tab').addClass('selected-tab');
        $('.tab-content-container').addClass('hidden');
        $('.add-contact-container').removeClass('hidden');
        $('.set-datetime-button').click();
        this.initVideoStream();
      });

      $('.my-info-tab').on('click', () => {
        $('.container').removeClass('yellow-bg blue-bg red-bg');
        $('.container').addClass('blue-bg');
        $('.tab').removeClass('selected-tab');
        $('.my-info-tab').addClass('selected-tab');
        $('.tab-content-container').addClass('hidden');
        $('.my-info-container').removeClass('hidden');
        this.stopStream();
      });

      $('.contact-history-tab').on('click', () => {
        $('.contacts-history-list-container').removeClass('hidden');
        $('.contacts-history-list-edit').addClass('hidden');
        $('.container').removeClass('yellow-bg blue-bg red-bg');
        $('.container').addClass('red-bg');
        $('.tab').removeClass('selected-tab');
        $('.contact-history-tab').addClass('selected-tab');
        $('.tab-content-container').addClass('hidden');
        $('.contact-history-container').removeClass('hidden');
        this.stopStream();
      });

      $('.info-input').on('input', () => {
        $('.info-save-button').prop('disabled', !$('.info-name-input').val());
      });

      $('.info-save-button').on('click', () => {
        this.saveInfo();
      });

      $('.contact-name-input').on('input', () => {
        $('.contact-add-button').prop('disabled', !$('.contact-name-input').val());
      });

      $('.set-datetime-button').on('click', () => {
        let now = new Date();
        let dateString = now.getDate();
        if(dateString.toString().length == 1) {
          dateString = '0' + dateString;
        }
        let monthString = now.getMonth() + 1;
        if(monthString.toString().length == 1) {
          monthString = '0' + monthString;
        }
        let yearString = now.getYear() + 1900;
        let date = yearString + '-' + monthString + '-' + dateString;
        let time = now.toTimeString().slice(0, 5);
        $('.contact-date-input').val(date);
        $('.contact-time-input').val(time);
      });

      $('.contact-add-button').on('click', () => {
        this.addContact();
      });

      $('.edit-cancel-button').on('click', () => {
        $('.contacts-history-list-container').removeClass('hidden');
        $('.contacts-history-list-edit').addClass('hidden');
      });

      $('.edit-save-button').on('click', () => {
        let index = $('.edit-index-input').val();
        let contact = contactList[parseInt(index)];
        contact.name = $('.edit-name-input').val();
        contact.phone = $('.edit-phone-input').val();
        contact.address = $('.edit-address-input').val();
        contact.date = $('.edit-date-input').val();
        contact.time = $('.edit-time-input').val();
        delete contact['dateObject'];
        this.updateContact(contact);
        contact.dateObject = new Date(`${contact.date} ${contact.time}`);
        this.rerenderContactList();
        $('.contacts-history-list-container').removeClass('hidden');
        $('.contacts-history-list-edit').addClass('hidden');
      });

      $('.edit-name-input').on('input', () => {
        $('.edit-save-button').prop('disabled', !$('.edit-name-input').val());
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopStream();
        } else {
          this.initVideoStream();
        }
      });
    };

    this.initDb = () => {
      let openRequest = indexedDB.open(dbName, dbVersion);

      openRequest.onupgradeneeded = (e) => {
        let db = openRequest.result;
        let oldVersion = e.oldVersion;
        switch(oldVersion) {
          case 0:
            // init to latest version
            if (!db.objectStoreNames.contains('myInfo')) {
              db.createObjectStore('myInfo', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('contacts')) {
              db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
            }
            break;
          case 1:
            // update to version 2
        }
      };

      openRequest.onerror = () => {
        console.error("Error", openRequest.error);
      };

      openRequest.onsuccess = () => {
        db = openRequest.result;
        db.onversionchange = () => {
          db.close();
          location.reload(true);
        };

        this.loadData();
      };
    }

    this.loadData = () => {
      let showMyInfoTab = false;
      let txn = db.transaction(['myInfo', 'contacts'], 'readonly');

      let myInfoStore = txn.objectStore('myInfo');
      let myInfoRequest = myInfoStore.getAll();
      myInfoRequest.onsuccess = () => {
        let myInfo = myInfoRequest.result;
        if(myInfo.length) {
          myInfo = myInfo[0];
          $('.info-name-input').val(myInfo.name);
          $('.info-phone-input').val(myInfo.phone);
          $('.info-address-input').val(myInfo.address);
          this.generateQrCode();
        } else {
          showMyInfoTab = true;
          $('.my-info-tab').click();
        }
      };

      let contactsStore = txn.objectStore('contacts');
      let contactsRequest = contactsStore.getAll();
      contactsRequest.onsuccess = () => {
        if(!showMyInfoTab) {
          $('.add-contact-tab').click();
        }
        contactList = contactsRequest.result;;
        this.rerenderContactList();
      };
    };

    this.rerenderContactList = () => {
      contactList.forEach((contact) => {
        contact.dateObject = new Date(`${contact.date} ${contact.time}`);
      });
      contactList = contactList.sort((a, b) => {
        return b.dateObject - a.dateObject;
      });

      $('.contacts-history-list-container').html('');
      let i = 0;
      contactList.forEach((contact) => {
        $('.contacts-history-list-container').append(`<div class='contact-list-row'>
          <div class='contact-list-row-item'>Name: ${contact.name}</div>
          <div class='contact-list-row-item'>Phone: ${contact.phone}</div>
          <div class='contact-list-row-item'>Address: ${contact.address}</div>
          <div class='contact-list-row-item'>Date: ${contact.dateObject.toLocaleString()}</div>
          <div>
            <button class='half-button blue-bg contact-edit-button' data-index='${i}'>Edit</button>
            <button class='half-button red-bg contact-delete-button' data-index='${i}'>Delete</button>
          </div>
        </div>`)
        i += 1;
      });

      $('.contact-edit-button').on('click', (e) => {
        let index = $(e.target).data('index');
        let contact = contactList[parseInt(index)];
        $('.edit-name-input').val(contact.name);
        $('.edit-phone-input').val(contact.phone);
        $('.edit-address-input').val(contact.address);
        let dateString = contact.dateObject.getDate();
        if(dateString.toString().length == 1) {
          dateString = '0' + dateString;
        }
        let monthString = contact.dateObject.getMonth() + 1;
        if(monthString.toString().length == 1) {
          monthString = '0' + monthString;
        }
        let yearString = contact.dateObject.getYear() + 1900;
        let date = yearString + '-' + monthString + '-' + dateString;
        let time = contact.dateObject.toTimeString().slice(0, 5);
        $('.edit-date-input').val(date);
        $('.edit-time-input').val(time);
        $('.edit-index-input').val(index);
        $('.contacts-history-list-container').addClass('hidden');
        $('.contacts-history-list-edit').removeClass('hidden');
      });

      $('.contact-delete-button').on('click', (e) => {
        let index = $(e.target).data('index');
        let contact = contactList[parseInt(index)];
        if(confirm('Are you sure you want to delete this contact log?')) {
          this.deleteContact(contact.id);
          contactList.splice(index, 1);
          this.rerenderContactList();
        }
      });
    };

    this.saveInfo = async () => {
      if(!db) return;

      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persisted storage granted: ${isPersisted}`);
      }

      let txn = db.transaction('myInfo', 'readwrite');
      let myInfoStore = txn.objectStore('myInfo');
      let getRequest = myInfoStore.getAll();
      getRequest.onsuccess = (event) => {
        let myInfo = event.target.result;


        let name = $('.info-name-input').val();
        let phone = $('.info-phone-input').val();
        let address = $('.info-address-input').val()

        if(!myInfo.length) {
          let addRequest = myInfoStore.add({
            name: name,
            phone: phone,
            address: address
          })

          addRequest.onsuccess = () => {
            this.generateQrCode();
            $('.info-save-button').prop('disabled', true);
          };
        } else {
          myInfo = myInfo[0];
          myInfo.name = name;
          myInfo.phone = phone;
          myInfo.address = address;

          let putRequest = myInfoStore.put(myInfo)

          putRequest.onsuccess = () => {
            this.generateQrCode();
            $('.info-save-button').prop('disabled', true);
          }
        }
      };
    };

    this.addContact = () => {
      if(!db) return;

      let txn = db.transaction('contacts', 'readwrite');
      let myInfoStore = txn.objectStore('contacts');
      let contactDetails = {
        name: $('.contact-name-input').val(),
        phone: $('.contact-phone-input').val(),
        address: $('.contact-address-input').val(),
        date: $('.contact-date-input').val(),
        time: $('.contact-time-input').val()
      }
      let addRequest = myInfoStore.add(contactDetails);
      addRequest.onsuccess = (e) => {
        contactDetails.id = e.target.result;
        contactList.push(contactDetails);
        this.rerenderContactList();
        $('.contact-name-input').val('');
        $('.contact-phone-input').val('');
        $('.contact-address-input').val('');
        $('.contact-add-button').prop('disabled', true);
      };
    };

    this.deleteContact = (id) => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').delete(id);
    };

    this.updateContact = (contact) => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').put(contact);
    }

    this.generateQrCode = () => {
      let name = $('.info-name-input').val();
      let phone = $('.info-phone-input').val();
      let address = $('.info-address-input').val()
      let qrString = `${name}|${phone}|${address}`;
      $('#qr-code-container').html('');
      let qrcode = new QRCode('qr-code-container');
      qrcode.makeCode(qrString);
    }

    this.initQrScanner = () => {
      if (!('mediaDevices' in navigator &&
        'getUserMedia' in navigator.mediaDevices &&
        'Worker' in window)) {
        $('.qr-scanner-container').addClass('hidden');
        return;
      }
      video = $('#camera')[0];
      snapshotCanvas = $('#snapshot')[0];
      snapshotContext = snapshotCanvas.getContext('2d');
      this.initVideoStream();
    };

    this.initVideoStream = () => {
      let config = {
        audio: false,
        video: {}
      }
      // config.video = currentDeviceId ? {deviceId: currentDeviceId} : {facingMode: 'environment'};
      config.video = {facingMode: 'environment'};

      this.stopStream();

      qrcodeWorker = new Worker('js/qrcode-worker.js');
      qrcodeWorker.postMessage({cmd: 'init'});
      qrcodeWorker.addEventListener('message', this.prefillAddContactForm);

      // let viewport = $('.qr-scanner-container');
      // viewport.css({'height':viewport.width()+'px'});
      // $('#camera').attr('width', viewport.width());

      navigator.mediaDevices.getUserMedia(config).then((stream) => {
        video.srcObject = stream;
        video.oncanplay = () => {
          let width = Math.min(video.videoWidth, video.videoHeight);
          let minWidth = Math.min(width, $(window).width());
          snapshotCanvas.width = width;
          snapshotCanvas.height = width;
          $('.qr-scanner-container').css({width: (minWidth - 20)+'px', height: (minWidth - 20)+'px'});
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          this.scanCode();
        };
      });
    };

    this.stopStream = () => {
      if(video.srcObject) {
        video.srcObject.getTracks()[0].stop();
      }
    }

    this.scanCode = (delayedStart = false) => {
      setTimeout(() => {
        let width = Math.min(video.videoWidth, video.videoHeight);
        snapshotContext.drawImage(video, 0, 0, width, width, 0, 0, width, width);
        let imageData = snapshotContext.getImageData(0, 0, width, width);

        qrcodeWorker.postMessage({
            cmd: 'process',
            width: width,
            height: width,
            imageData: imageData
        });
      }, delayedStart ? 2000 : 120);
    };

    this.prefillAddContactForm = (e) => {
      if(e.data !== false) {
        console.log('found!');
        let split = e.data.split('|');
        let name = split[0];
        let phone = split[1];
        let address = split[2];
        $('.contact-name-input').val(name);
        $('.contact-phone-input').val(phone);
        $('.contact-address-input').val(address);
        if(!!name) {
          $('.contact-add-button').prop('disabled', false);
        }
        if(confirm('QR code scanned successfully! Do you want to add this contact?')) {
          this.addContact();
          alert('contact added successfully!');
        }
      }
      this.scanCode(true);
    }

    this.log = (text) => {
      // $('.tab-content-container').append($(`<div>${text}</div>`));
    }
  }

  bks.init();
});
