(function () {
    var STORAGE_PREFIX = 'roster:';
    var loadingOverlay = null;
    var loadingTimer = null;
    var loadingSkeletonTargets = [];

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
            return;
        }

        callback();
    }

    function storageKey(name) {
        return STORAGE_PREFIX + name;
    }

    function safeGet(name) {
        try {
            return window.sessionStorage.getItem(storageKey(name));
        } catch (error) {
            return null;
        }
    }

    function safeSet(name, value) {
        try {
            window.sessionStorage.setItem(storageKey(name), value);
        } catch (error) {
            return;
        }
    }

    function safeRemove(name) {
        try {
            window.sessionStorage.removeItem(storageKey(name));
        } catch (error) {
            return;
        }
    }

    function normalizePath(path) {
        var cleaned = String(path || '').replace(/\\/g, '/');

        cleaned = cleaned.split('?')[0];
        cleaned = cleaned.split('#')[0];
        cleaned = cleaned.replace(/\/+$/, '');

        if (!cleaned) {
            return '/';
        }

        return cleaned;
    }

    function resolvePath(href) {
        try {
            return normalizePath(new URL(href, window.location.href).pathname);
        } catch (error) {
            return normalizePath(href);
        }
    }

    function pathMatches(href) {
        var current = normalizePath(window.location.pathname);
        var target = resolvePath(href);

        if (current === target) {
            return true;
        }

        return current.slice(-target.length - 1) === '/' + target;
    }

    function ensureFeedback(form) {
        var feedback = form.querySelector('.js-form-feedback');

        if (!feedback) {
            feedback = document.createElement('p');
            feedback.className = 'js-form-feedback';
            feedback.setAttribute('aria-live', 'polite');
            form.appendChild(feedback);
        }

        return feedback;
    }

    function setFeedback(form, message, tone) {
        var feedback = ensureFeedback(form);

        feedback.className = 'js-form-feedback js-form-feedback--' + (tone || 'info');
        feedback.textContent = message;
    }

    function clearFeedback(form) {
        var feedback = form.querySelector('.js-form-feedback');

        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'js-form-feedback';
        }
    }

    function clearInvalidFields(form) {
        var invalidFields = form.querySelectorAll('.is-invalid');
        var index;

        for (index = 0; index < invalidFields.length; index += 1) {
            invalidFields[index].classList.remove('is-invalid');
            invalidFields[index].removeAttribute('aria-invalid');
        }
    }

    function markInvalidField(field) {
        if (!field) {
            return;
        }

        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');
    }

    function findAnchor(node) {
        var current = node;

        while (current && current !== document) {
            if (current.tagName === 'A') {
                return current;
            }

            current = current.parentNode;
        }

        return null;
    }

    function isSameOriginLink(anchor) {
        var targetUrl;

        if (!anchor || !anchor.href) {
            return false;
        }

        if (anchor.target && anchor.target.toLowerCase() === '_blank') {
            return false;
        }

        if (anchor.hasAttribute('download')) {
            return false;
        }

        try {
            targetUrl = new URL(anchor.href, window.location.href);
        } catch (error) {
            return false;
        }

        return targetUrl.origin === window.location.origin;
    }

    function shouldInterceptLink(anchor) {
        var targetUrl;
        var targetPath;

        if (!isSameOriginLink(anchor)) {
            return false;
        }

        targetUrl = new URL(anchor.href, window.location.href);
        targetPath = normalizePath(targetUrl.pathname);

        if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash) {
            return false;
        }

        if (anchor.getAttribute('href') === '#') {
            return false;
        }

        if (targetPath === '/menu.html' || targetPath.slice(-9) === 'menu.html') {
            return false;
        }

        return true;
    }

    function createLoadingOverlay(message) {
        var overlay;
        var panel;
        var spinner;
        var text;

        overlay = document.createElement('div');
        overlay.className = 'roster-loading-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        panel = document.createElement('div');
        panel.className = 'roster-loading-panel';

        spinner = document.createElement('span');
        spinner.className = 'roster-loading-spinner';

        text = document.createElement('p');
        text.className = 'roster-loading-text';
        text.textContent = message || 'Carregando...';

        panel.appendChild(spinner);
        panel.appendChild(text);
        overlay.appendChild(panel);

        return overlay;
    }

    function setLoadingMessage(message) {
        var text;

        if (!loadingOverlay) {
            return;
        }

        text = loadingOverlay.querySelector('.roster-loading-text');

        if (text) {
            text.textContent = message || 'Carregando...';
        }
    }

    function getSkeletonTargets() {
        var selectors = [];

        if (document.querySelector('.home-main')) {
            selectors.push('.home-greeting', '.home-actions', '.card-jornada', '.status-card');
        }

        if (document.querySelector('.trade-main')) {
            selectors.push('.trade-titulo', '.trade-descricao', '.trade-secao-oferta', '.form-oferta');
        }

        if (document.querySelector('.escolher-main')) {
            selectors.push('.escolher-titulo', '.escolher-item');
        }

        if (document.querySelector('.boarding-main')) {
            selectors.push('.boarding-emergencia__link', '.boarding-item', '.boarding-ai', '.boarding-ai__form');
        }

        if (document.querySelector('.chat-main')) {
            selectors.push('.chat-topo', '.chat-messages', '.chat-form');
        }

        if (document.querySelector('.status-main')) {
            selectors.push('.status-card-page');
        }

        if (document.querySelector('.formulario')) {
            selectors.push('.card-jornada', '.formulario');
        }

        if (document.querySelector('.info-main')) {
            selectors.push('.info-titulo', '.info-lista__item');
        }

        if (document.querySelector('.confirmacao-main')) {
            selectors.push('.confirmacao-main');
        }

        if (document.querySelector('.main-content')) {
            selectors.push('.perfil-top', '.perfil-menu__item', '.perfil-logout');
        }

        if (document.querySelector('.escala-main')) {
            selectors.push('.escala-titulo', '.escala-item');
        }

        if (document.querySelector('.emergencia-main')) {
            selectors.push('.emergencia-alert', '.slider-cancelar');
        }

        return selectors;
    }

    function applySkeletonState() {
        var selectors = getSkeletonTargets();
        var index;

        loadingSkeletonTargets = [];

        for (index = 0; index < selectors.length; index += 1) {
            var nodes = document.querySelectorAll(selectors[index]);
            var nodeIndex;

            for (nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
                nodes[nodeIndex].classList.add('is-skeleton');
                loadingSkeletonTargets.push(nodes[nodeIndex]);
            }
        }
    }

    function clearSkeletonState() {
        var index;

        for (index = 0; index < loadingSkeletonTargets.length; index += 1) {
            loadingSkeletonTargets[index].classList.remove('is-skeleton');
        }

        loadingSkeletonTargets = [];
    }

    function showLoadingUI(message) {
        if (!loadingOverlay) {
            loadingOverlay = createLoadingOverlay(message);
            document.body.appendChild(loadingOverlay);
        }

        document.body.classList.add('is-loading');
        setLoadingMessage(message);
        loadingOverlay.setAttribute('aria-hidden', 'false');

        if (loadingTimer) {
            window.clearTimeout(loadingTimer);
            loadingTimer = null;
        }
    }

    function hideLoadingUI() {
        if (loadingTimer) {
            window.clearTimeout(loadingTimer);
            loadingTimer = null;
        }

        clearSkeletonState();
        document.body.classList.remove('is-loading');

        if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.parentNode.removeChild(loadingOverlay);
        }

        loadingOverlay = null;
    }

    function scheduleHideLoading() {
        if (loadingTimer) {
            window.clearTimeout(loadingTimer);
        }

        loadingTimer = window.setTimeout(function () {
            hideLoadingUI();
        }, 250);
    }

    function initLoading() {
        if (currentPageName() === 'menu.html') {
            return;
        }

        var startTime = Date.now();

        showLoadingUI('Carregando Roster...');
        applySkeletonState();

        window.addEventListener('pageshow', function (event) {
            if (event.persisted) {
                hideLoadingUI();
            }
        });

        window.addEventListener('load', function () {
            var elapsed = Date.now() - startTime;
            var delay = Math.max(0, 350 - elapsed);

            window.setTimeout(function () {
                scheduleHideLoading();
            }, delay);
        });

        document.addEventListener('click', function (event) {
            var anchor = findAnchor(event.target);

            if (!anchor || !shouldInterceptLink(anchor)) {
                return;
            }

            event.preventDefault();
            showLoadingUI('Abrindo página...');
            window.setTimeout(function () {
                window.location.href = anchor.href;
            }, 180);
        });
    }

    function initMenu() {
        var isMenuPage = currentPageName() === 'menu.html';
        var closing = false;

        if (!isMenuPage) {
            return;
        }

        document.body.classList.add('menu-page-open');

        window.requestAnimationFrame(function () {
            document.body.classList.add('menu-page-open--ready');
        });

        function closeMenu() {
            var referrerUrl;
            var shouldGoBack = false;

            if (closing) {
                return;
            }

            closing = true;
            document.body.classList.add('menu-closing');

            try {
                referrerUrl = document.referrer ? new URL(document.referrer, window.location.href) : null;
                shouldGoBack = !!referrerUrl && referrerUrl.origin === window.location.origin && resolvePath(referrerUrl.pathname).slice(-9) !== 'menu.html';
            } catch (error) {
                shouldGoBack = false;
            }

            window.setTimeout(function () {
                if (shouldGoBack) {
                    window.history.back();
                    return;
                }

                window.location.href = safeGet('last-page') || 'index.html';
            }, 260);
        }

        document.addEventListener('click', function (event) {
            var insideMenu = event.target && event.target.closest ? event.target.closest('.menu-sidebar') : null;

            if (insideMenu) {
                return;
            }

            closeMenu();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });
    }

    function currentPageName() {
        var path = normalizePath(window.location.pathname);
        var parts = path.split('/');
        var name = parts[parts.length - 1];

        if (!name) {
            return 'index.html';
        }

        return name;
    }

    function storeLastPage() {
        var pageName = currentPageName();

        if (pageName !== 'menu.html') {
            safeSet('last-page', normalizePath(window.location.pathname));
        }
    }

    function highlightMenuItem() {
        var items = document.querySelectorAll('.menu-list a[data-menu-target]');
        var savedPage = safeGet('last-page');
        var current = savedPage || normalizePath(window.location.pathname);
        var index;

        for (index = 0; index < items.length; index += 1) {
            var item = items[index];
            var target = resolvePath(item.getAttribute('data-menu-target'));
            var isActive = current === target || current.slice(-target.length - 1) === '/' + target;

            item.classList.remove('js-menu-active');
            item.removeAttribute('aria-current');

            if (isActive) {
                item.classList.add('js-menu-active');
                item.setAttribute('aria-current', 'page');
            }
        }
    }

    function formatDateLabel(dateValue) {
        var parts;

        if (!dateValue) {
            return '';
        }

        parts = dateValue.split('-');

        if (parts.length !== 3) {
            return dateValue;
        }

        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    function initTrade() {
        var form = document.querySelector('.form-oferta');
        var textarea;
        var label;
        var params;
        var route;
        var date;
        var jornadaTexto;
        var draft;

        if (!form) {
            return;
        }

        textarea = document.getElementById('jornada-oferta');
        label = document.getElementById('trade-jornada-selecionada');
        params = new URLSearchParams(window.location.search);
        route = params.get('route') || '';
        date = params.get('date') || '';
        jornadaTexto = [route, date ? 'Dia ' + formatDateLabel(date) : ''].filter(Boolean).join(' | ');

        if (label) {
            label.textContent = jornadaTexto || 'nenhuma';
        }

        if (textarea) {
            draft = safeGet('trade-draft');

            if (draft) {
                textarea.value = draft;
            } else if (jornadaTexto) {
                textarea.value = jornadaTexto;
            }

            textarea.addEventListener('input', function () {
                safeSet('trade-draft', textarea.value);
            });
        }

        form.addEventListener('submit', function (event) {
            var value = textarea ? textarea.value.trim() : '';

            clearFeedback(form);
            clearInvalidFields(form);

            if (!value) {
                event.preventDefault();
                setFeedback(form, 'Digite a jornada ofertada antes de continuar.', 'error');
                markInvalidField(textarea);

                if (textarea) {
                    textarea.focus();
                }

                return;
            }

            safeRemove('trade-draft');
            setFeedback(form, 'Enviando solicitação...', 'info');
            event.preventDefault();
            showLoadingUI('Enviando solicitação...');

            window.setTimeout(function () {
                form.submit();
            }, 220);
        });
    }

    function initLm() {
        var form = document.querySelector('.formulario');
        var select;
        var textarea;
        var header;
        var content;
        var storedMotivo;
        var storedObservacao;

        if (!form) {
            return;
        }

        select = form.querySelector('.campo-select');
        textarea = form.querySelector('.campo-textarea');
        header = document.querySelector('header.topo');
        content = document.querySelector('main.conteudo');

        function adjustContentPadding() {
            if (!header || !content) {
                return;
            }

            content.style.paddingTop = (header.getBoundingClientRect().height + 12) + 'px';
        }

        if (select) {
            storedMotivo = safeGet('lm-motivo');

            if (storedMotivo) {
                select.value = storedMotivo;
            }

            select.addEventListener('change', function () {
                safeSet('lm-motivo', select.value);
            });
        }

        if (textarea) {
            storedObservacao = safeGet('lm-observacao');

            if (storedObservacao) {
                textarea.value = storedObservacao;
            }

            textarea.addEventListener('input', function () {
                safeSet('lm-observacao', textarea.value);
            });
        }

        adjustContentPadding();
        window.addEventListener('load', adjustContentPadding);
        window.addEventListener('resize', adjustContentPadding);

        form.addEventListener('submit', function (event) {
            var motivo = select ? select.value.trim() : '';
            var observacao = textarea ? textarea.value.trim() : '';

            clearFeedback(form);
            clearInvalidFields(form);

            if (!motivo || motivo === 'Selecione...') {
                event.preventDefault();
                setFeedback(form, 'Escolha um motivo para a solicitação.', 'error');
                markInvalidField(select);

                if (select) {
                    select.focus();
                }

                return;
            }

            if (!observacao) {
                event.preventDefault();
                setFeedback(form, 'Descreva rapidamente a situação antes de enviar.', 'error');
                markInvalidField(textarea);

                if (textarea) {
                    textarea.focus();
                }

                return;
            }

            safeRemove('lm-motivo');
            safeRemove('lm-observacao');
            setFeedback(form, 'Enviando solicitação...', 'info');
            event.preventDefault();
            showLoadingUI('Enviando solicitação...');

            window.setTimeout(function () {
                form.submit();
            }, 220);
        });
    }

    function buildChatReply(message) {
        var resposta = 'Posso ajudar com bagagem, documentação, prioridade de embarque e orientações de bordo.';

        if (message.trim().toLowerCase().indexOf('oi') === 0) {
            return 'Oi, Goret! ' + resposta;
        }

        return resposta;
    }

    function renderChatMessage(messages, role, text) {
        var bubble = document.createElement('div');

        bubble.className = 'chat-bubble chat-bubble--' + role;
        bubble.textContent = text;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
    }

    function initChat() {
        var form = document.querySelector('.chat-form');
        var input = document.querySelector('.chat-input');
        var messages = document.querySelector('.chat-messages');
        var params = new URLSearchParams(window.location.search);
        var initialMessage = params.get('mensagem');

        if (!form || !input || !messages) {
            return;
        }

        function addChatExchange(userText) {
            renderChatMessage(messages, 'user', userText);
            renderChatMessage(messages, 'ai', buildChatReply(userText));
        }

        if (initialMessage) {
            addChatExchange(initialMessage);
        }

        form.addEventListener('submit', function (event) {
            var value = input.value.trim();

            event.preventDefault();

            if (!value) {
                input.focus();
                return;
            }

            addChatExchange(value);
            input.value = '';
        });
    }

    function initStatus() {
        var meter = document.querySelector('.status-meter');
        var valueLabel = document.querySelector('.status-valor');
        var description = document.querySelector('.status-descricao');
        var value;
        var level;

        if (!meter) {
            return;
        }

        value = parseInt(meter.getAttribute('value'), 10);

        if (isNaN(value)) {
            value = 0;
        }

        if (value < 40) {
            level = 'low';
        } else if (value < 70) {
            level = 'warn';
        } else {
            level = 'normal';
        }

        meter.setAttribute('aria-valuenow', String(value));

        if (level === 'normal') {
            meter.removeAttribute('data-level');
        } else {
            meter.setAttribute('data-level', level);
        }

        if (valueLabel) {
            valueLabel.textContent = value + '%';
        }

        if (description) {
            if (level === 'low') {
                description.textContent = 'Seu nível de fadiga está baixo. Continue acompanhando para evitar sobrecarga.';
            } else if (level === 'warn') {
                description.textContent = 'Seu nível atual pede atenção. Vale monitorar antes do próximo voo.';
            } else {
                description.textContent = 'Seu nível atual está dentro da faixa normal. Continue acompanhando antes do próximo voo.';
            }
        }
    }

    function initBoarding() {
        var form = document.querySelector('.boarding-ai__form');
        var input = document.querySelector('.boarding-ai__input');

        if (!form || !input) {
            return;
        }

        form.addEventListener('submit', function (event) {
            var value = input.value.trim();

            if (!value) {
                return;
            }

            event.preventDefault();
            showLoadingUI('Abrindo Roster AI...');

            window.setTimeout(function () {
                form.submit();
            }, 220);
        });
    }

    function initEmergency() {
        var slider = document.querySelector('.slider-cancelar');
        var track = document.querySelector('.slider-cancelar__trilho');
        var knob = document.querySelector('.slider-cancelar__bolha');
        var label = document.querySelector('.emergencia-acoes__texto');
        var activePointerId = null;
        var isUnlocked = false;
        var maxOffset = 0;

        if (!slider || !track || !knob) {
            return;
        }

        slider.setAttribute('role', 'slider');
        slider.setAttribute('tabindex', '0');
        slider.setAttribute('aria-label', 'Deslize para cancelar a solicitação de emergência');
        slider.setAttribute('aria-valuemin', '0');
        slider.setAttribute('aria-valuemax', '100');
        slider.setAttribute('aria-valuenow', '0');

        function refreshMaxOffset() {
            maxOffset = Math.max(0, track.clientWidth - knob.offsetWidth - 16);
        }

        function setSliderPosition(offset) {
            var clamped = Math.max(0, Math.min(offset, maxOffset));
            var progress = maxOffset ? Math.round((clamped / maxOffset) * 100) : 0;

            knob.style.left = (8 + clamped) + 'px';
            slider.setAttribute('aria-valuenow', String(progress));

            if (label) {
                if (progress >= 80) {
                    label.textContent = 'Solte para cancelar a solicitação';
                } else {
                    label.textContent = 'Deslize para cancelar a solicitação';
                }
            }

            return progress;
        }

        function resetSlider() {
            isUnlocked = false;
            slider.classList.remove('is-unlocked');
            knob.style.transition = 'left 0.18s ease';
            setSliderPosition(0);
        }

        function unlockSlider() {
            isUnlocked = true;
            slider.classList.add('is-unlocked');

            if (label) {
                label.textContent = 'Cancelando solicitação...';
            }

            safeSet('emergency-cancelled', '1');
            window.location.href = slider.getAttribute('href');
        }

        function handlePointerMove(event) {
            var trackRect;
            var offset;

            if (activePointerId === null) {
                return;
            }

            trackRect = track.getBoundingClientRect();
            offset = event.clientX - trackRect.left - (knob.offsetWidth / 2) - 8;

            knob.style.transition = 'none';
            setSliderPosition(offset);
        }

        function handlePointerUp(event) {
            var progress;

            if (activePointerId === null) {
                return;
            }

            activePointerId = null;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);

            progress = parseInt(slider.getAttribute('aria-valuenow'), 10);

            knob.style.transition = 'left 0.18s ease';

            if (progress >= 80) {
                unlockSlider();
                return;
            }

            resetSlider();
        }

        function startDrag(event) {
            if (isUnlocked) {
                return;
            }

            refreshMaxOffset();
            activePointerId = event.pointerId;
            slider.setPointerCapture(activePointerId);
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerUp);
            handlePointerMove(event);
        }

        refreshMaxOffset();
        resetSlider();

        window.addEventListener('resize', function () {
            if (!isUnlocked) {
                refreshMaxOffset();
                resetSlider();
            }
        });

        slider.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            startDrag(event);
        });

        slider.addEventListener('click', function (event) {
            if (!isUnlocked) {
                event.preventDefault();
            }
        });

        slider.addEventListener('keydown', function (event) {
            var current;

            if (isUnlocked) {
                return;
            }

            current = parseInt(slider.getAttribute('aria-valuenow'), 10) || 0;

            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault();
                refreshMaxOffset();
                setSliderPosition((current / 100) * maxOffset + (maxOffset * 0.12));
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault();
                refreshMaxOffset();
                setSliderPosition((current / 100) * maxOffset - (maxOffset * 0.12));
            }

            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (current >= 80) {
                    unlockSlider();
                }
            }
        });
    }

    function rootRelativePrefix() {
        var link = document.querySelector('link[href*="CSS/style.css"]');
        var href = link ? link.getAttribute('href') : '';
        var marker = href.indexOf('CSS/style.css');

        if (marker === -1) {
            return '';
        }

        return href.slice(0, marker);
    }

    function initNotifications() {
        var prefix = rootRelativePrefix();
        var bells = document.querySelectorAll('a[aria-label="Notificações"]');
        var onNotificationsPage = currentPageName() === 'notificacoes.html';
        var unread;
        var index;

        if (onNotificationsPage) {
            safeSet('notif-unread', '0');
        } else if (safeGet('notif-unread') === null) {
            safeSet('notif-unread', '2');
        }

        unread = parseInt(safeGet('notif-unread'), 10);

        if (isNaN(unread)) {
            unread = 0;
        }

        for (index = 0; index < bells.length; index += 1) {
            var bell = bells[index];
            var badge;

            bell.setAttribute('href', prefix + 'notificacoes.html');

            if (onNotificationsPage || unread <= 0) {
                continue;
            }

            badge = bell.querySelector('.header-notif-badge');

            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'header-notif-badge';
                badge.setAttribute('aria-hidden', 'true');
                bell.style.position = 'relative';
                bell.appendChild(badge);
            }

            badge.textContent = unread > 9 ? '9+' : String(unread);
        }
    }

    ready(function () {
        initLoading();
        initMenu();
        storeLastPage();
        highlightMenuItem();
        initNotifications();
        initTrade();
        initLm();
        initBoarding();
        initChat();
        initStatus();
        initEmergency();
    });
}());