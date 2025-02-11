document.addEventListener("DOMContentLoaded", function() {
    // Define o nome do usuário no dashboard (este valor pode vir de uma API ou sessão)
    document.getElementById('userName').innerText = "Usuário";

    // Controles para exibir/ocultar o formulário de dispositivo
    const toggleBtn = document.getElementById('toggleDeviceForm');
    const deviceFormContainer = document.getElementById('deviceFormContainer');
    const closeDeviceForm = document.getElementById('closeDeviceForm');

    toggleBtn.addEventListener('click', function() {
        deviceFormContainer.style.display = 'block';
    });

    closeDeviceForm.addEventListener('click', function() {
        deviceFormContainer.style.display = 'none';
    });

    // Controles para exibir/ocultar o painel de configurações
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    settingsBtn.addEventListener('click', function() {
        settingsPanel.style.display = (settingsPanel.style.display === 'none' || settingsPanel.style.display === '') ? 'block' : 'none';
    });

    // Listener para o botão de fullscreen
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    fullscreenBtn.addEventListener('click', function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                fullscreenBtn.innerText = "Sair do Fullscreen";
            }).catch(err => {
                console.error(`Erro ao ativar o fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => {
                fullscreenBtn.innerText = "Fullscreen";
            }).catch(err => {
                console.error(`Erro ao sair do fullscreen: ${err.message}`);
            });
        }
    });

    // Listener para fechar o formulário de edição
    const closeEditDeviceForm = document.getElementById('closeEditDeviceForm');
    closeEditDeviceForm.addEventListener('click', function() {
        document.getElementById('editDeviceFormContainer').style.display = 'none';
    });

    // Carrega as configurações do usuário a partir do banco de dados
    fetch('/api/settings')
      .then(response => response.json())
      .then(config => {
          // Configura o intervalo de atualização e o tamanho do painel
          autoUpdateInterval = parseInt(config.update_interval) || 10;
          document.getElementById('autoUpdateInterval').value = autoUpdateInterval;
          const scaleValue = parseInt(config.monitoring_panel_scale) || 100;
          document.getElementById('monitoringPanelScale').value = scaleValue;
          const baseHeight = 700; // altura padrão para 100%
          document.getElementById('monitoring-panel').style.height = (baseHeight * (scaleValue / 100)) + "px";
          startAutoUpdate();
      })
      .catch(err => console.error('Erro ao carregar configurações:', err));

    // Variáveis para atualização automática dos status
    let autoUpdateInterval = 10; // valor padrão (será sobrescrito pelo config)
    let updateTimer;

    function startAutoUpdate() {
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(updateStatuses, autoUpdateInterval * 1000);
    }

    // Função que atualiza os status de todos os dispositivos e toca o alarme se houver transição para offline
    function updateStatuses() {
        const devices = document.querySelectorAll('.device-icon');
        devices.forEach(device => {
            const ip = device.getAttribute('data-ip');
            if (ip) {
                fetch('/api/ping/' + ip)
                    .then(response => response.json())
                    .then(data => {
                        const prevStatus = device.getAttribute('data-status') || 'online';
                        device.setAttribute('data-status', data.status);
                        device.style.borderColor = (data.status === 'online') ? 'green' : 'red';
                        if (data.status === 'offline' && prevStatus !== 'offline' && device.getAttribute('data-alarm-enabled') === "1") {
                            const alarmAudio = document.getElementById('alarmAudio');
                            alarmAudio.play();
                        }
                    })
                    .catch(error => console.error('Erro ao atualizar status:', error));
            }
        });
    }

    // Listener para salvar as configurações do painel diretamente no banco de dados
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const autoUpdateInput = document.getElementById('autoUpdateInterval');
    const monitoringPanelScaleInput = document.getElementById('monitoringPanelScale');
    saveSettingsBtn.addEventListener('click', function() {
        const newInterval = parseInt(autoUpdateInput.value);
        const newScale = parseInt(monitoringPanelScaleInput.value);
        if (newInterval && newInterval > 0 && !isNaN(newScale) && newScale >= 0 && newScale <= 300) {
            // Atualiza a interface
            autoUpdateInterval = newInterval;
            startAutoUpdate();
            const baseHeight = 700;
            document.getElementById('monitoring-panel').style.height = (baseHeight * (newScale / 100)) + "px";
            alert("Intervalo de atualização: " + newInterval + " segundos.\n" +
                  "Tamanho do campo de dispositivos: " + newScale + "%");
            settingsPanel.style.display = 'none';
            // Envia as novas configurações para o servidor
            fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ update_interval: newInterval, monitoring_panel_scale: newScale })
            })
            .then(response => response.json())
            .then(data => {
                if(!data.success) {
                    alert(data.error || "Erro ao salvar configurações");
                }
            })
            .catch(err => console.error('Erro ao salvar configurações:', err));
        } else {
            alert("Por favor, insira valores válidos para o intervalo e o tamanho do campo (0 a 300).");
        }
    });

    // Função para o drag and drop
    function dragMoveListener(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
        target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    // Configuração do Interact.js com evento onend para verificar alterações de posição e exibir botão "Salvar Posição"
    interact('.device-icon').draggable({
        inertia: true,
        modifiers: [
            interact.modifiers.restrictRect({
                restriction: 'parent',
                endOnly: true
            })
        ],
        onmove: dragMoveListener,
        onend: function (event) {
            const target = event.target;
            const newX = parseFloat(target.getAttribute('data-x')) || 0;
            const newY = parseFloat(target.getAttribute('data-y')) || 0;
            const origX = parseFloat(target.getAttribute('data-original-x')) || 0;
            const origY = parseFloat(target.getAttribute('data-original-y')) || 0;
            if(newX !== origX || newY !== origY) {
                let saveBtn = target.querySelector('.btn-save-position');
                if(!saveBtn) {
                    saveBtn = document.createElement('button');
                    saveBtn.className = 'btn-save-position';
                    saveBtn.innerText = 'Salvar Posição';
                    // Posiciona o botão acima do ícone
                    saveBtn.style.position = 'absolute';
                    saveBtn.style.top = '-30px';
                    saveBtn.style.left = '50%';
                    saveBtn.style.transform = 'translateX(-50%)';
                    saveBtn.style.padding = '3px 6px';
                    saveBtn.style.fontSize = '10px';
                    saveBtn.style.backgroundColor = '#00bfff';
                    saveBtn.style.color = '#fff';
                    saveBtn.style.border = 'none';
                    saveBtn.style.borderRadius = '3px';
                    saveBtn.style.cursor = 'pointer';
                    saveBtn.style.zIndex = '100';
                    target.appendChild(saveBtn);
                    saveBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const deviceId = target.getAttribute('data-device-id');
                        if (deviceId) {
                            fetch('/api/device/position/' + deviceId, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pos_x: newX, pos_y: newY })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if(data.success) {
                                    alert('Posição salva com sucesso!');
                                    target.setAttribute('data-original-x', newX);
                                    target.setAttribute('data-original-y', newY);
                                    saveBtn.remove();
                                } else {
                                    alert(data.error || 'Erro ao salvar posição');
                                }
                            })
                            .catch(error => console.error('Erro ao atualizar posição:', error));
                        }
                    });
                }
            } else {
                let existingBtn = target.querySelector('.btn-save-position');
                if(existingBtn) {
                    existingBtn.remove();
                }
            }
        }
    });

    // Manipulação do formulário para adicionar dispositivo
    const deviceForm = document.getElementById('deviceForm');
    deviceForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(deviceForm);

        fetch('/api/device', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            deviceForm.reset();
            deviceFormContainer.style.display = 'none';
            loadDevices();
        })
        .catch(error => console.error('Erro:', error));
    });

    // Listener para editar dispositivo via formulário de edição
    const editDeviceForm = document.getElementById('editDeviceForm');
    editDeviceForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const editDeviceId = document.getElementById('editDeviceId').value;
        const formData = new FormData(editDeviceForm);
        fetch('/api/device/' + editDeviceId, {
            method: 'PUT',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            editDeviceForm.reset();
            document.getElementById('editDeviceFormContainer').style.display = 'none';
            loadDevices();
        })
        .catch(error => console.error('Erro ao editar dispositivo:', error));
    });

    // Função para carregar os dispositivos do usuário
    function loadDevices() {
        fetch('/api/devices')
            .then(response => response.json())
            .then(devices => {
                const panel = document.getElementById('monitoring-panel');
                panel.innerHTML = '';
                devices.forEach(device => {
                    const div = document.createElement('div');
                    div.className = 'device-icon';
                    const posX = (device.pos_x !== undefined && device.pos_x !== null) ? device.pos_x : 50;
                    const posY = (device.pos_y !== undefined && device.pos_y !== null) ? device.pos_y : 50;
                    div.style.left = posX + "px";
                    div.style.top = posY + "px";
                    div.setAttribute('data-x', posX);
                    div.setAttribute('data-y', posY);
                    div.setAttribute('data-original-x', posX);
                    div.setAttribute('data-original-y', posY);
                    div.setAttribute('data-ip', device.ip);
                    div.setAttribute('data-alarm-enabled', device.alarm_enabled);
                    div.setAttribute('data-device-id', device.id);

                    const img = document.createElement('img');
                    img.src = device.icone ? '/uploads/' + device.icone : 'img/placeholder.png';
                    img.alt = device.nome;
                    if (device.icon_offset_x !== undefined && device.icon_offset_y !== undefined) {
                        img.style.objectPosition = device.icon_offset_x + "px " + device.icon_offset_y + "px";
                    } else {
                        img.style.objectPosition = "0px 0px";
                    }
                    div.appendChild(img);

                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'device-name';
                    nameLabel.innerText = device.nome;
                    div.appendChild(nameLabel);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-delete';
                    deleteBtn.innerText = 'X';
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (confirm('Deseja deletar este dispositivo?')) {
                            fetch('/api/device/' + device.id, {
                                method: 'DELETE'
                            })
                            .then(response => response.json())
                            .then(data => {
                                alert(data.message);
                                loadDevices();
                            })
                            .catch(error => console.error('Erro ao deletar dispositivo:', error));
                        }
                    });
                    div.appendChild(deleteBtn);

                    const optionsDiv = document.createElement('div');
                    optionsDiv.className = 'device-options';

                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-edit';
                    editBtn.innerText = 'Editar';
                    editBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        document.getElementById('editDeviceId').value = device.id;
                        document.getElementById('editNome').value = device.nome;
                        document.getElementById('editIp').value = device.ip;
                        document.getElementById('editIntervalo').value = device.intervalo || 5;
                        document.getElementById('editAlarm').value = device.alarm_enabled;
                        document.getElementById('editOffsetX').value = device.icon_offset_x || 0;
                        document.getElementById('editOffsetY').value = device.icon_offset_y || 0;
                        document.getElementById('editDeviceFormContainer').style.display = 'block';
                    });
                    optionsDiv.appendChild(editBtn);

                    const toggleAlarmBtn = document.createElement('button');
                    toggleAlarmBtn.className = 'btn-toggle-alarm';
                    toggleAlarmBtn.innerText = (device.alarm_enabled == 1) ? 'Desativar Alarme' : 'Ativar Alarme';
                    toggleAlarmBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const btn = this;
                        const newAlarmValue = (device.alarm_enabled == 1) ? 0 : 1;
                        const formData = new FormData();
                        formData.append('nome', device.nome);
                        formData.append('ip', device.ip);
                        formData.append('intervalo', device.intervalo);
                        formData.append('alarm_enabled', newAlarmValue);
                        formData.append('icon_offset_x', device.icon_offset_x || 0);
                        formData.append('icon_offset_y', device.icon_offset_y || 0);
                        fetch('/api/device/' + device.id, {
                            method: 'PUT',
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => {
                            if(data.success) {
                                btn.innerText = (newAlarmValue == 1) ? 'Desativar Alarme' : 'Ativar Alarme';
                                alert("Alarme " + (newAlarmValue == 1 ? "habilitado" : "desabilitado"));
                                device.setAttribute('data-alarm-enabled', newAlarmValue);
                                device.alarm_enabled = newAlarmValue;
                            } else {
                                alert(data.error || "Erro ao atualizar alarme");
                            }
                            loadDevices();
                        })
                        .catch(error => console.error('Erro ao atualizar alarme:', error));
                    });
                    optionsDiv.appendChild(toggleAlarmBtn);

                    div.appendChild(optionsDiv);

                    fetch('/api/ping/' + device.ip)
                        .then(response => response.json())
                        .then(data => {
                            div.setAttribute('data-status', data.status);
                            div.style.borderColor = (data.status === 'online') ? 'green' : 'red';
                        });

                    panel.appendChild(div);

                    interact(div).draggable({
                        inertia: true,
                        modifiers: [
                            interact.modifiers.restrictRect({
                                restriction: 'parent',
                                endOnly: true
                            })
                        ],
                        onmove: dragMoveListener,
                        onend: function (event) {
                            const target = event.target;
                            const newX = parseFloat(target.getAttribute('data-x')) || 0;
                            const newY = parseFloat(target.getAttribute('data-y')) || 0;
                            const origX = parseFloat(target.getAttribute('data-original-x')) || 0;
                            const origY = parseFloat(target.getAttribute('data-original-y')) || 0;
                            if(newX !== origX || newY !== origY) {
                                let saveBtn = target.querySelector('.btn-save-position');
                                if(!saveBtn) {
                                    saveBtn = document.createElement('button');
                                    saveBtn.className = 'btn-save-position';
                                    saveBtn.innerText = 'Salvar Posição';
                                    // Posiciona o botão acima do ícone
                                    saveBtn.style.position = 'absolute';
                                    saveBtn.style.top = '-30px';
                                    saveBtn.style.left = '50%';
                                    saveBtn.style.transform = 'translateX(-50%)';
                                    saveBtn.style.padding = '3px 6px';
                                    saveBtn.style.fontSize = '10px';
                                    saveBtn.style.backgroundColor = '#00bfff';
                                    saveBtn.style.color = '#fff';
                                    saveBtn.style.border = 'none';
                                    saveBtn.style.borderRadius = '3px';
                                    saveBtn.style.cursor = 'pointer';
                                    saveBtn.style.zIndex = '100';
                                    target.appendChild(saveBtn);
                                    saveBtn.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        const deviceId = target.getAttribute('data-device-id');
                                        if (deviceId) {
                                            fetch('/api/device/position/' + deviceId, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ pos_x: newX, pos_y: newY })
                                            })
                                            .then(response => response.json())
                                            .then(data => {
                                                if(data.success) {
                                                    alert('Posição salva com sucesso!');
                                                    target.setAttribute('data-original-x', newX);
                                                    target.setAttribute('data-original-y', newY);
                                                    saveBtn.remove();
                                                } else {
                                                    alert(data.error || 'Erro ao salvar posição');
                                                }
                                            })
                                            .catch(error => console.error('Erro ao atualizar posição:', error));
                                        }
                                    });
                                }
                            } else {
                                let existingBtn = target.querySelector('.btn-save-position');
                                if(existingBtn) {
                                    existingBtn.remove();
                                }
                            }
                        }
                    });
                });
            })
            .catch(error => console.error('Erro ao carregar dispositivos:', error));
    }

    loadDevices();
    startAutoUpdate();
});
