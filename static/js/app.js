String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

// $(function() {
//     FastClick.attach(document.body, {
//         tapDelay: 650
//     });
// });



var ajaxErrorFunction = function(e, message) {
    // Unauthorized
    // console.log(message);
    if (e.status === 401) {
        $.alert({
            title: 'Authorization required',
            content: 'You must be a logged in user in oreder to like dreams. <br><br><a href="/login">Log In</a> or <a class="link btn btn-xs btn-orange" href="/sign-up">Sign Up</a>',
        });
        return;
    }
    $.alert({
        title: 'Whoops, something went wrong',
        content: 'You can report this issue to: contact@deepdreamgenerator.com',
    });
}

$(function(){

    var dream = {
        likeButtons: {},
        like: function(uid, targetLikeState, callback) {
            var endPoint = '/dream/votes/like/' + uid;
            if (targetLikeState == false) {
                endPoint = '/dream/votes/unlike/' + uid;
            }
            $.ajax({
                url: endPoint,
                type: 'GET',
                dataType: 'json',
                data: {},
                success: function(data) {
                    if (data.success) {
                        callback(data.currentLikeState, data.likesCount);
                    } else {
                        $.alert({
                            title: 'Message',
                            content: data.error,
                        });
                    }
                },
                error: function(e) {
                    // Unauthorized
                    if (e.status === 401) {
                        $.alert({
                            title: 'Authorization required',
                            content: 'You must be a logged in user in oreder to like dreams. <br><br><a href="/login">Log In</a> or <a class="link btn btn-xs btn-orange" href="/sign-up">Sign Up</a>',
                        });
                        return;
                    }
                    $.alert({
                        title: 'Whoops, something went wrong',
                        content: 'You can report this issue to: contact@deepdreamgenerator.com',
                    });
                }
            });
        },
        refreshDreamLikeEl: function($dreamLike) {
            var dreamUid = $dreamLike.attr('ddg-uid');
            if (dream.likeButtons[dreamUid]) {
                var likesCount = dream.likeButtons[dreamUid]['likesCount'];
                $dreamLike.attr('ddg-likes', likesCount);
                $($dreamLike.find('.number')).html(likesCount)
                dream.likeButtons[dreamUid]['currentLikeState'] ? $dreamLike.addClass('liked') : $dreamLike.removeClass('liked');
            }
        },
        updateLikeButtons: function(parentClass) {

            var dreamLikeClass = '.dream-like';

            if (parentClass === undefined) {
                // Nothing
            } else {
                dreamLikeClass = parentClass + ' .dream-like';
            }

            $.each($(dreamLikeClass), function() {
                var dreamUid = $(this).attr('ddg-uid');
                if ( ! dream.likeButtons[dreamUid]) {
                    dream.likeButtons[dreamUid] = {
                        currentLikeState: $(this).hasClass('liked'),
                        likesCount: $(this).attr('ddg-likes')
                    }
                }
                dream.refreshDreamLikeEl($(this));

                $($(this).find('.btn-action')).off('click');
                $($(this).find('.btn-action')).on('click', function() {
                    var $dreamLike = $(this).parents('.dream-like');
                    var targetDreamUid = $($dreamLike).attr('ddg-uid');
                    var targetLikeState = $(this).hasClass('fa-heart') ? false : true;

                    dream.like(targetDreamUid, targetLikeState, function(currentLikeState, likesCount) {
                        dream.likeButtons[targetDreamUid] = {
                            currentLikeState: currentLikeState,
                            likesCount: likesCount
                        }
                        dream.refreshDreamLikeEl($dreamLike);
                    });
                });
            });
        }
    }

    var generatorImageIsAdded = false;

    dream.updateLikeButtons();


    $('.upload-file-with-preview').change(function(e) {
        $('#image-preview').addClass('hidden');
        $('#input-image-md5').val('');
        if ($(this).prop('files')[0]) {
            //  Docs: https://github.com/blueimp/JavaScript-Load-Image
            loadImage(
                e.target.files[0],
                function (img) {
                    let $tempImg = $(img);
                    $('#image-preview').remove();
                    $('.upload-file-with-preview').after($tempImg);
                    $tempImg.attr('id', 'image-preview').css('margin-left', '25px');
                },
                {
                    maxWidth: 400,
                    maxWidth: 400,
                    orientation: true
                }
            );
        }
    });

    $('#show-original').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if ($('#show-original').hasClass('original')) {
            $('#show-original').text('Original');
            $('#original-image').remove();
            $('#show-original').removeClass('original');
            $('#dream-image').show();
        } else {
            $('#show-original').text('Dream');
            $('#show-original').addClass('original');
            $('#original-image').remove();
            $('#dream-image').hide();
            var originalSrc = $('#dream-image').attr('src');
            originalSrc = originalSrc.replace('/ddream/', '/ddream-origgin/').replace('/eu-ddream/', '/eu-ddream-origgin/');
            var $newImage = $('<img id="original-image" class="img-responsive" src="' + originalSrc + '" style="margin-bottom: 20px;">');
            $('#dream-image').after($newImage);
        }
    });

    // Style selection section {{{
    $('.style-image-wrapper').on('click', function(event) {

        // FileManager support (NEW)
        if ($(this).hasClass('popular-styles-button')) {
            $('.popular-styles').toggleClass('hidden');
            $('.default-styles').toggleClass('hidden');
            return;
        }
        $('.generator-settings-styles .fm-selection').remove();

        var $parentRadiosWrapper = $(this).parents('.radiobuttons');

        $parentRadiosWrapper.find('.style-image-wrapper').removeClass('selected');
        $(this).addClass('selected');

        $parentRadiosWrapper.find('.style-image-wrapper input').prop('checked', false);
        $(this).find('input').prop('checked', true);

        // Deep Style - for upload your own image
        if ($(this).find('input').val() == 'custom') {
            $('#upload-style-image').slideDown(250);
        } else {
            $('#upload-style-image').slideUp(250);
        }
    });
    // }}}

    // Generator submit {{{
    $('.generator-form').on('submit', function(event) {
        if (this.generatorImageIsAdded) {
            console.log('~~!!!~~');
            return true;
        }
        event.preventDefault();
        event.stopPropagation();

        var $form = $(this);
        var $uploadForm = $('.upload-image-form');

        $uploadForm.css('display', 'none');
        $uploadForm.appendTo($form);

        this.generatorImageIsAdded = true;

        $('.generator-submit')
            .prop('disabled', true)
            .addClass('disabled')
            .text('Submitting...');

        $form.submit();
    });
    // }}}


    // Generator - radiobuts scale bar {{{
    var updateScaleBars = function() {
        var breaker = false;
        $.each($('.radiobuttons.scale'), function() {
            $(this).find('.filled').removeClass('filled');
            breaker = false;
            var currentLabel = '';
            $.each($(this).find('label'), function() {
                var $radio = $(this).find('input');
                if ($radio.is(':checked')) {
                    breaker = true;
                    currentLabel = $radio.attr('ddg-label');
                }
                if (breaker) {
                    return;
                }
                $(this).addClass('filled');
            });
            $(this).find('.selected').html(currentLabel);
        })
    }
    $('.radiobuttons.scale input').on('change', function() {
        updateScaleBars();
    })
    updateScaleBars();
    // }}}


    // Generator - radio buttons negative prompt {{{
    $('.radiobuttons#radios-negativePrompt input').on('change', function() {
        if ($(this).val() == 20) {
            $('.negative-prompt-wrapper').removeClass('hidden');
        } else {
            $('.negative-prompt-wrapper').addClass('hidden');
            // $('.negative-prompt-wrapper textarea').val('');
        }
    })
    // }}}


    // Delete dream {{{
    /** Example:
      * <div class="ddg-attributes" ddg-uid="a0sdhgfs980" ddg-delete-redirect="/">
      *    <div class="ddg-delete">Delete Dream</div>
      * </div>
      */
    $('.ddg-delete').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        var $dream = $($(this).parents('.ddg-attributes'));
        var uid = $dream.attr('ddg-uid');
        var redirect = $dream.attr('ddg-delete-redirect');
        var isDreamJob = $dream.attr('ddg-dream-job') === '1';

        $dream.css('opacity', '0.5');

        var endPoint = '/dream/delete/' + uid;
        if (isDreamJob) {
            endPoint = '/dream-job/delete/' + uid;
        }

        $.confirm({
            title: 'Delete Dream',
            content: '<p>Are you sure you want to delete this Dream?</p>' +
                    '<div class="well" style="margin-bottom: 0px;"><small><strong>Note:</strong> This will also delete the result Dream image file but won\'t affect the used based or style images.</small></div>',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            buttons: {
                Cancel: function () {
                    $dream.css('opacity', '1');
                },
                Yes: {
                    text: 'Delete',
                    btnClass: 'btn-orange',
                    keys: ['enter'],
                    action: function(){
                        $dream.fadeOut();
                        $('.single-dream').html('<div class="text-center"> <br><br><br><p>Deleting...</p> <div class="uil-ring-css" style="-webkit-transform: scale(0.6);"><div></div></div></div>');
                        $.ajax({
                            url: endPoint,
                            type: 'GET',
                            dataType: 'json',
                            data: {},
                            success: function(data) {
                                if (redirect && redirect.length > 0) {
                                    window.location = redirect;
                                }
                            },
                            error: function(e) {
                                $.alert({
                                    title: 'Whoops, something went wrong',
                                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                                });
                            }
                        });
                    }
                }
            }
        });

    });
    // }}}

    // Delete style {{{
    // Example:
    //    <div class="style">
    //        ...
    //        <div class="ddg-delete-style" style-id="123444">Delete Dream</div>
    //    </div>
    $('.ddg-delete-style').on('click', function(event) {
        event.preventDefault(); event.stopPropagation();
        var $style = $($(this).parents('.style'));
        var styleId = $(this).attr('style-id');

        $.confirm({
            title: 'Delete Style',
            content: 'Are you sure you want to delete this style?',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            buttons: {
                Cancel: function () { },
                Yes: {
                    text: 'Delete',
                    btnClass: 'btn-orange',
                    keys: ['enter'],
                    action: function(){
                        $style.fadeOut(100);
                        $.ajax({
                            url: '/style/delete/' + styleId,
                            type: 'GET',
                            dataType: 'json',
                            data: {},
                            success: function(data) {
                                if ( ! data.success) {
                                    $.alert({
                                        title: 'Whoops, something went wrong',
                                        content: data.error,
                                    });
                                }
                            },
                            error: function(e) {
                                $.alert({
                                    title: 'Whoops, something went wrong',
                                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                                });
                            }
                        });
                    }
                }
            }
        });

    });
    // }}}

    var ddgAlert = function(title, message, type)
    {
        return $.confirm({
            title: title,
            content: message,
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            buttons: {
                Ok: function () {
                }
            }
        });
    }


    // Image selector (from existing ones) {{{
    var initSelection = function(selectedCallback, popup) {
        $('.user-images-wrapper .img-wrapper').off('click');
        $('.user-images-wrapper .img-wrapper').on('click', function() {
            $('.user-images-wrapper .img-wrapper').removeClass('selected');
            $(this).addClass('selected');

            var imageMd5 = $($(this).find('img')).attr('ddg-image-md5');
            $('#input-image-md5').val(imageMd5);
            $('#image-preview').attr('src', $('.user-images-wrapper .img-wrapper.selected img').attr('ddg-preview-src'));
            $('#image-preview').removeClass('hidden');
            selectedCallback && selectedCallback(imageMd5);
            $('#image-for-dream').val('')
            popup && popup.close();
        })
    }
    var chooseImageDialog = function(selectedCallback)
    {
        var popup = $.confirm({
            title: 'Latest Images ',
            columnClass: 'large',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            content: 'URL:' + ddg.loadUserImages,
            onContentReady: function(){
                initSelection(selectedCallback, popup);
            },
            buttons: {
                Cancel: function () { }
            }
        });
    }
    initSelection();

    $('.ddg-choose-image').on('click', function(event) {
        chooseImageDialog();
    });
    // }}}


    //  Use same style {{{
    $('.copy-style').on('click', function(event) {
        let dreamUid = $(this).attr('ddg-dream-uid');
        let $button = $(this);
        $button.text('Copying...').css('opacity', '0.8').css('cursor', 'default').attr('disabled', 'true');
        $button.off('click');

        let popupCopyStyle = $.alert({
            title: 'Message',
            content: 'Copying style&hellip; <div style="position: absolute; top: 10px; margin-left: 5px;" class="loader"></div>',
        });


        $.ajax({
            url: '/dream/style/copy/' + dreamUid,
            type: 'POST',
            dataType: 'json',
            data: {},
            success: function(data) {
                if (data.success) {
                    $button.text('Copied').css('opacity', '1').css('background', 'green').css('color', '#fff');
                    let content = 'Style copied &nbsp; <i class="fa fa-check-circle-o" style="font-size: 26px; color: #8ac249;"></i>';
                    if (data.resultFolderLink) {
                        content = content + '<br><br>To folder:<br> <a style="font-size: 1.5em;" href="' + data.resultFolderLink + '">Styles &raquo; ' + data.resultFolderName + '</a>';
                    }
                    popupCopyStyle.setContent(content);
                } else {
                    $button.text('Error').css('opacity', '1');
                    popupCopyStyle.setContent(data.error);
                }
            },
            error: function(e) {
                $button.text('Error').css('opacity', '1');
                popupCopyStyle.setContent({
                    title: 'Whoops, something went wrong',
                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                });
            }
        });
    });
    // }}}


    //  {{{ Client side load of image when uploading
    $('.ddg-image-upload-input').change(function(){
        if (this.files && this.files[0]) {
            var reader = new FileReader();
            var _this = this;
            reader.onload = function (e) {
                $('#' + $(_this).attr('ddg-target-img-id')).attr('src', e.target.result);
            }
            reader.readAsDataURL(this.files[0]);
        }
    });
    //  }}}


    // Popup with info - global {{{
    /* Example usage:
        <a class="popup-info" ddg-popup-target="#example-id" ddg-popup-title="Nice popup" href="#">Button</a>
        <div id="example-id" class="hidden"> ...content </div>
    */
    $(document).on('click', '.popup-info', function(event) {
        event.preventDefault();
        event.stopPropagation();
        var infoHtml = $( $(this).attr('ddg-popup-target') ).html();
        ddgGlobalAlert = $.confirm({
            title: $(this).attr('ddg-popup-title'),
            columnClass: 'col-lg-6 col-lg-offset-3',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            content: infoHtml,
            buttons: {
                Close: function () { }
            },
            onOpen: function () {
                reportControls();

            }
        });
    });
    // }}}

    // Notifications dropdown {{{
    $('#notification-wrapper.main-notifications').on('show.bs.dropdown', function () {
        $.ajax({
            url: '/notifications/seen',
            type: 'GET',
            dataType: 'json',
            data: {},
            success: function(data) {
                $('#notification-wrapper.main-notifications .fb-style-notification').remove();
            },
            error: function(e) {
                $.alert({
                    title: 'Whoops, something went wrong',
                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                });
            }
        });
    })
    $('#notification-wrapper.message-notifications').on('show.bs.dropdown', function () {
        $('#notification-wrapper.message-notifications .fb-style-notification').remove();
    })
    // }}}

    // Load Later (images) {{{
    /**
      * Example Usage:
      * <div class="ddg-load-later">
      *    <div class="ddg-load-later-object">...<img ddg-src="">..</div>
      *    ...............
      * </div>
      */
    $(window).scroll(function() {
        // if($(window).scrollTop() + $(window).height() == ($(document).height())) {
        if($(window).scrollTop() + $(window).height() >= ($(document).height() - 500)) {
            var i = 0;
            $.each($('.ddg-load-later .ddg-load-later-object'), function(el) {
                if (i++ > 5) {
                    return;
                }
                $(this).removeClass('ddg-load-later-object');
                var images = $(this).find('[ddg-src]');
                $.each(images, function() {
                    var $image = $(this);
                    $image.attr('src', $image.attr('ddg-src'));
                });
            });
        }
    });
    // }}}

    // Edit access {{{
    $('.ddg-edit-access').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        var _this = this;
        var dreamUid = $(this).attr('ddg-uid');
        var isPublic = ($(this).attr('ddg-access') === String(ddg.const.dream.access.PUBLIC));
        var checkedAsPrivate = isPublic ? '' : 'checked';
        var checkedAsPublic = isPublic ? 'checked' : '';

        $.confirm({
            title: 'Edit access',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            content: '' +
            '<div class="form-group">' +
            '   <br>' +
            '   <div class="radiobuttons">' +
            '       <label>' +
            '           <input type="radio" name="access" value="' + ddg.const.dream.access.PRIVATE + '" ' + checkedAsPrivate + '>' +
            '           <span>Private</span>' +
            '       </label>' +
            '       <label>' +
            '           <input type="radio" name="access" value="' + ddg.const.dream.access.PUBLIC + '" ' + checkedAsPublic + '>' +
            '           <span>Public</span>' +
            '       </label>' +
            '   </div>' +
            '</div>',
            buttons: {
                Cancel: function () {},
                Save: {
                    text: 'Save',
                    btnClass: 'link btn btn-orange',
                    action: function () {
                        var access = this.$content.find('input[name=access]:checked').val();
                        if (access == ddg.const.dream.access.PUBLIC) {
                            window.location = '/publish/' + dreamUid;
                            return;
                        }
                        $.ajax({
                            url: '/dream/access/' + dreamUid,
                            type: 'POST',
                            dataType: 'json',
                            data: { access: access },
                            success: function(data) {
                                if (data.success == true) {
                                    var newAccess = String(data.access);
                                    $(_this).attr('ddg-access', newAccess);
                                    newAccess = (newAccess === String(ddg.const.dream.access.PRIVATE)) ?
                                        'Private' : 'Public';
                                    $.alert('Access updated to: ' + newAccess);
                                } else {
                                    $.alert(data.error);
                                }
                            },
                            error: function(e) {
                                $.alert({
                                    title: 'Whoops, something went wrong',
                                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                                });
                            }
                        });
                    }
                }
            }
        });
    });
    // }}}

    // Add title {{{
    $('.ddg-edit-title').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        var _this = this;
        var dreamUid = $(this).attr('ddg-uid');
        // var title = $(this).attr('ddg-title');

        $.confirm({
            title: 'Update title',
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            content: '' +
            '<div class="form-group">' +
            '   <br>' +
            '   <input class="form-control title" autofocus type="text" name="title" value="">' +
            '</div>',
            buttons: {
                Cancel: function () {},
                Save: {
                    text: 'Save',
                    btnClass: 'link btn btn-orange',
                    action: function () {
                        var title = this.$content.find('input[name=title]').val();
                        console.log( title);
                        $.ajax({
                            url: '/dream/update-title/' + dreamUid,
                            type: 'POST',
                            dataType: 'json',
                            data: { title: title },
                            success: function(data) {
                                if (data.success == true) {
                                    $.alert('<center>Title updated</center>');
                                    $(_this).attr('ddg-title', data.title);
                                } else {
                                    $.alert(data.error);
                                }
                            },
                            error: function(e) {
                                $.alert({
                                    title: 'Whoops, something went wrong',
                                    content: 'You can report this issue to: contact@deepdreamgenerator.com',
                                });
                            }
                        });
                    }
                }
            }
        });
    });
    // }}}


    // Deep Dream - Disable layers when custom type is selected {{{
    if($('input[name=guideImage]:checked').val() != 'na') {
        $('.deep-dream-layers').addClass('hidden');
        $('.layers input[type=radio]').prop('checked', false);
    }
    $('input[name=guideImage]').on('click', function(event) {
        if ($(this).val() != 'na') {
            $('.deep-dream-layers').addClass('hidden');
            $('.layers input[type=radio]').prop('checked', false);
        } else {
            $('.deep-dream-layers').removeClass('hidden');
        }
    });
    // }}}


    // Report {{{
    var reportControls = function() {
        $('.report-button').off('click');
        $('.report-button').on('click', function() {
            var data = {
                objectId: $(this).attr('objectId'),
                objectType: $(this).attr('objectType'),
                comment: $($(this).parents('.report-form')).find('.comment').val()
            }
            $.ajax({
                url: '/report/create',
                type: 'POST',
                dataType: 'json',
                data: data,
                success: function(res) {
                    ddgGlobalAlert && ddgGlobalAlert.close();
                    if (res.success == true) {
                        ddgAlert('Thank you', 'The report has been successfully sent', 'success');
                    } else {
                        ddgAlert('Whoops', res.error, 'error');
                    }
                },
                error: function(e) {
                    ddgGlobalAlert && ddgGlobalAlert.close();
                    ddgAlert('Whoops', 'Something went wrong. Report this issue to: contact@deepdreamgenerator.com', 'error');
                }
            });
        });
    }
    // }}}


    // Lighty gallery {{{
    var $lg = $('.light-gallery').lightGallery({
        selector: '.light-gallery-item',
        thumbnail:false
    });
    $lg.on('onBeforeSlide.lg',function(event, index){
        $('.extra-added').remove();
        var $currentImage = $('.lg-current .lg-object.lg-image');
        if ($currentImage.attr('old-src')) {
            $currentImage.attr('src', $currentImage.attr('old-src'));
        }

    });
    $lg.on('onAfterAppendSubHtml.lg',function(event, index){
        var dreamUid = $('.lg-sub-html a').attr('uid');
        if (dreamUid == undefined) {
            return;
        }
        $.ajax({
            url: '/dream/info/' + dreamUid,
            type: 'GET',
            dataType: 'json',
            success: function(res) {
                if (res.success == true) {
                    var smallStyleImage = '';
                    if (res.dream.styleSmall) {
                        smallStyleImage = '  <img class="style" src="' + res.dream.styleSmall + '">';
                    }
                    $('.extra-added').remove();
                    $('.lg-like-btn').remove();
                    let lgToolbar = '';
                    if (res.dream.showSmallImages == '1') {
                        lgToolbar =
                        '<div class="extra-added">' +
                        '  <img class="original" src="' + res.dream.originalSmall + '">' +
                                smallStyleImage +
                        '</div>';
                    }
                    $('.lg-toolbar').append(
                        lgToolbar +

                        // Like button
                        '<div class="lg-like-btn dream-like ' + ( res.isLiked ? 'liked' : '' ) + '" ddg-uid="'+ res.dream.uid +'" ddg-likes="'+ res.dream.likes +'"> '+
                        '    <span class="btn-action fa fa-heart-o" title="Like"></span> '+
                        '    <span class="btn-action fa fa-heart" title="Click to Unlike"></span> '+
                        '    <span class="number">'+ res.dream.likes +'</span> '+
                        '</div> '
                    );

                    var $currentImage = $('.lg-current .lg-object.lg-image');
                    var oldImageSrc = $currentImage.attr('src');

                    var changeCurrentImage = function($thumbInitiator, targetImageUrl) {
                        var wasSelected = $thumbInitiator.hasClass('selected');
                        $('.extra-added img').removeClass('selected');
                        if (wasSelected) {
                            $currentImage.attr('src', oldImageSrc);
                            return;
                        }
                        $thumbInitiator.addClass('selected');
                        $currentImage.attr('src', targetImageUrl);
                        $currentImage.attr('old-src', oldImageSrc);
                    }

                    $('.extra-added .original').off('click');
                    $('.extra-added .style').off('click');
                    $('.extra-added .original').on('click', function() {
                        changeCurrentImage($(this), res.dream.original);
                    });
                    $('.extra-added .style').on('click', function() {
                        changeCurrentImage($(this), res.dream.style);
                    });

                    dream && dream.updateLikeButtons('.lg-toolbar');
                    if (res.isLiked) {
                        $('.lg-toolbar .lg-like-btn.dream-like').addClass('liked');
                    }

                } else {
                    ddgAlert('Whoops', res.error, 'error');
                }
            },
            error: function(e) {
                // ddgGlobalAlert && ddgGlobalAlert.close();
                console.log('Whoops, something went wrong. Report this issue to: contact@deepdreamgenerator.com', 'error');
            }
        });
    });
    // }}}

    //  Search {{{
    $('.search-form').on('submit', function() {
        $('.search-form .submit').attr('disabled', true);
        $('.search-form .submit').text('Searching...');
    });
    // }}}

    //  DSv1 Extra Resolutions {{{
    $('#ds-v1-radio').on('click', function() {
        $('.ds-2-only').addClass('hidden');
        $('.ds-1-only').removeClass('hidden');
    });
    $('#ds-v2-radio').on('click', function() {
        $('.ds-2-only').removeClass('hidden');
        $('.ds-1-only').addClass('hidden');
    });
    // }}}

    // Single dream - expand/collapse main image
    $('.single-dream .expand-image').on('click', function() {
        if ($(this).hasClass('fa-arrows-alt')) {
            $(this).addClass('fa-compress');
            $(this).removeClass('fa-arrows-alt');
            $('#dream-image').removeClass('collapsed');
        } else {
            $(this).removeClass('fa-compress');
            $(this).addClass('fa-arrows-alt');
            $('#dream-image').addClass('collapsed');
        }
    });

});


$(function(){
    var endPoint = '/feed/dreams/data';
    var i = $('.feed .feed-object').map(function(){
        return $(this).attr('i');
    }).get();

    // Remove like state (just in case if cahing on page hit is activated and not background one)
    $('.feed .feed-object .dream-like').removeClass('liked');

    $.ajax({
        url: endPoint,
        type: 'POST',
        dataType: 'json',
        data: { i: i},
        success: function(data) {
            if (data.success) {
                $.each(data.dreams, function() {
                    var $test = $('.feed .feed-object[i=' + this + ']');
                    $test.find('.dream-like').addClass('liked');
                });
            } else {
                console.log(data.error);
            }
        },
        error: function(e) {
            // Unauthorized
            if (e.status === 401) {
                return;
            }
            console.log('Whoops, something went wrong');
        }
    });
});

// Generic loading button
$(function(){
    $('.submit-loading-btn').on('click', function(event, element) {
        event.stopPropagation();
        event.preventDefault();
        $(this).html('Submitting...');
        $(this).attr('disabled', 'true')
        $(this).css('opacity', '0.5')
        $(this).parents('form').submit();
    });
});
// Generic loading form (NOTE: classes - .submit-loading-form, .btn-submit, .btn-submit-label)
$(function(){
    $('.submit-loading-form').on('submit', function(event, element) {
        let $submitButton = $(this).find('.btn-submit');
        let label = $submitButton.attr('btn-submit-label');
        if (label == undefined) {
            label = 'Submitting...';
        }
        $submitButton.val(label);
        $submitButton.attr('disabled', 'true')
        $submitButton.css('opacity', '0.5')
    });
});

// Generic confirmation alert
$(function() {

    $('.alert-confirm').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        let thisEl = $(this);
        let message = thisEl.attr('alert-message');
        let buttonText = thisEl.attr('alert-button');
        $.confirm({
            title: null,
            content: message,
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            buttons: {
                Cancel: function () {},
                Yes: {
                    text: buttonText,
                    btnClass: 'btn-primary',
                    keys: ['enter'],
                    action: function () {
                        thisEl.html('Submitting...').attr('disabled', 'true').css('opacity', '0.5');
                        thisEl.parents('form').submit();
                    }
                }
            }
        });
    });

});

// Text 2 Dream stuff
$(function() {

    // Need for re-generate
    $('.t2d-modifiers .remove').off('click');
    $('.t2d-modifiers .remove').on('click', function(event) {
        $(this).parents('.modifier').remove();
    });

    let popupModifierHandler = function() {
        $('.t2d-popup-modifiers .modifier').off('click');
        $('.t2d-popup-modifiers .modifier').on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            $(this).addClass('selected');
            addModifierToPrompt($(this).text());
        });
    }

    let deleteModifierHandler = function() {
        $('.t2d-popup-modifiers .delete-btn').off('click');
        $('.t2d-popup-modifiers .delete-btn').on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();

            let modifierId = $(this).attr('modifier-id');
            $.confirm({
                title: 'Delete Modifier',
                content: 'Are you sure you want to delete this modifier?',
                escapeKey: true,
                backgroundDismiss: true,
                animation: 'top',
                closeAnimation: 'top',
                buttons: {
                    Cancel: function () { },
                    Yes: {
                        text: 'Delete',
                        btnClass: 'btn-orange',
                        keys: ['enter'],
                        action: function() {
                            deleteModifier(modifierId);
                        }
                    }
                }
            });
        });
    }

    let saveModifier = function(type, modifier) {
        if (modifier.length < 3) {
            $.alert('Modifier cannot be less than 3 characters');
            return;
        }
        $.ajax({
            url: '/text2dream/save-modifier',
            type: 'POST',
            dataType: 'json',
            data: {
                'type': type,
                'modifier': modifier
            },
            success: function(data) {
                if (data.success) {
                    $('.t2d-modifiers .action-btn').toggleClass('hidden');
                    $('.t2d-modifiers .new-modifier').remove();
                    let $newModifier = $('<a href="#" class="modifier"></a>');
                    $newModifier.text(modifier);
                    $newModifier.attr('modifier-id', data.modifierId);

                    $deleteBtn = $('<i class="delete-btn fa fa-close"></i>');
                    $deleteBtn.attr('modifier-id', data.modifierId);
                    $deleteBtn.appendTo($newModifier);

                    $('.t2d-modifiers .add-your-own').before($newModifier);

                    popupModifierHandler();
                    deleteModifierHandler();

                } else {
                    $.alert(data.message);
                }
            },
            error: ajaxErrorFunction
        });
    }

    let deleteModifier = function(modifierId) {
        $.ajax({
            url: '/text2dream/delete-modifier',
            type: 'POST',
            dataType: 'json',
            data: {
                'modifierId': modifierId
            },
            success: function(data) {
                if (data.success) {
                    $('.t2d-modifiers .modifier[modifier-id=' + modifierId + ']').remove();
                } else {
                    $.alert(data.message);
                }
            },
            error: ajaxErrorFunction
        });
    }

    let generateButtonSubscribeMode = function() {
        if ($('#t2d-advanced-settings .radiobuttons .subscriber-only input:checked').length > 0) {
            $('#t2d-form .generate-button-wrapper').addClass('subscribe');
        } else {
            $('#t2d-form .generate-button-wrapper').removeClass('subscribe');
        }
    }

    let addModifierToPrompt = function(modifierString) {

        let $modifierEl = $('<a href="#" class="modifier"></a>');
        $modifierEl.text(modifierString);

        let $input = $('<input name="modifiers[]" type="hidden">');
        $input.val(modifierString);
        $input.appendTo($modifierEl);
        $('<i class="fa fa-times remove"></i>').appendTo($modifierEl);

        $modifierEl.appendTo($('.modifiers-list'));

        $('.t2d-modifiers .remove').off('click');
        $('.t2d-modifiers .remove').on('click', function(event) {
            $(this).parents('.modifier').remove();
        });

    }



    $('.help-popup').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        let contentId = $(this).attr('content-id');
        let message = $('#' + contentId).html();
        $.alert({
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            title: 'Text 2 Dream Help',
            columnClass: 'fm-popup-dialog col-lg-10 col-lg-offset-1',
            content: message,
            buttons: {
                Cancel: {
                    btnClass: 'btn btn-default cancel',
                    text: '<i class="fa fa-times"></i>'
                }
            }
        });
    });

    $('#t2d-form .t2d-type input').change(function() {
        if ($(this).val() == '20') { // base
            $('#t2d-advanced-settings').removeClass('hidden');
            $('#t2d-fast-settings').addClass('hidden');
            $('#t2d-form .generate-button-wrapper').removeClass('hidden');
        } else {
            $('#t2d-fast-settings').removeClass('hidden');
            $('#t2d-advanced-settings').addClass('hidden');
            $('#t2d-form .generate-button-wrapper').addClass('hidden');

        }
        // $('.text-prompt .text-input').val('');
    });

    $('#t2d-advanced-settings-toggle').change(function() {
        if (this.checked) {
            $('#t2d-advanced-settings-wrapper').collapse('hide');
        } else {
            $('#t2d-advanced-settings-wrapper').collapse('show');
        }
    });

    $('#t2d-random-prompt-btn').on('click', function() {
        $.ajax({
            url: '/text2dream/random-prompt/',
            type: 'POST',
            dataType: 'json',
            data: {},
            success: function(data) {
                $('.text-prompt .text-input').val(data.prompt.prompt);
                $('.modifiers-list').text('');
                $.each(data.prompt.modifiers, function() {
                    addModifierToPrompt(this);
                });
                if (data.prompt.faceFix) {
                    $('#radios-faceEnhance input[value="10"]').prop('checked', true);
                    $('#radios-aiUpscale input[value="2"]').prop('checked', true);
                } else {
                    $('#radios-faceEnhance input[value="0"]').prop('checked', true);
                    $('#radios-aiUpscale input[value="0"]').prop('checked', true);
                }
                $('#radios-aiUpscale input[value="2"]').trigger('change');

            },
            error: ajaxErrorFunction
        });
    });


    $('#t2d-add-modifiers').on('click', function() {
        let $initButton = $(this);
        let type = '10'; // fast
        if ($('#t2d-form .t2d-type input.type-base').prop('checked')) {
            type = '20'; // base
        }

        let dialog = $.confirm({
            escapeKey: true,
            backgroundDismiss: true,
            title: false,
            animation: 'top',
            closeAnimation: 'top',
            animationSpeed: 300,
            columnClass: 't2d-popup-modifiers col-lg-8 col-lg-offset-2',
            containerFluid: true,
            content: 'url:/text2dream/modifiers',
            buttons: {
                Cancel: {
                    btnClass: 'btn btn-default cancel',
                    text: 'Close'
                }
            },
            contentLoaded: function (data, status, xhr) { },
            onContentReady: function () {

                // Add your own modifier
                $('.t2d-popup-modifiers .add-your-own').on('click', function(event) {
                    $(this).before($('<input type="text" class="form-control new-modifier" />'))
                    $('.new-modifier').focus();
                    $('.t2d-modifiers .action-btn').toggleClass('hidden');
                });
                $('.t2d-popup-modifiers .save-your-own').on('click', function(event) {
                    saveModifier(type, $('.new-modifier').val());
                });

                popupModifierHandler();
                deleteModifierHandler();
            }

        });
    });

    $('#t2d-advanced-settings .radiobuttons input').change(function() {
        generateButtonSubscribeMode();
    });
    generateButtonSubscribeMode();


    $('.feed .init-image').on('click', function() {
        $.alert({
            escapeKey: true,
            backgroundDismiss: true,
            animation: 'top',
            closeAnimation: 'top',
            title: null,
            columnClass: 'fm-popup-dialog col-lg-10 col-lg-offset-1',
            content: 'The AI generation of this Dream has started from this initial image.<br><br>' +
                '<img style="max-width: 600px;" class="t2d-init-image" src="' + $(this).attr('src-md') + '">',
            buttons: {
                Cancel: {
                    btnClass: 'btn btn-default cancel',
                    text: '<i class="fa fa-times"></i>'
                }
            }
        });
    });

    let preserveStructureSelection = function() {
        if ($('#t2d-advanced-settings #id-preserve-structure').is(':checked')) {
            $('#drop-aiModel').attr('disabled', '1');
            $('#id-useModelStyle').parent('div').addClass('hidden');
            $('.settings-item.ai-models').css('opacity', '0.4');
        } else {
            $('.settings-item.ai-models').css('opacity', '1');
            $('#drop-aiModel').removeAttr('disabled');
            $('#id-useModelStyle').parent('div').removeClass('hidden');
        }
    }
    preserveStructureSelection();
    $('#t2d-advanced-settings #id-preserve-structure').on('change', function() {
        preserveStructureSelection();
    });


});


// Calculate Energy
$(function() {
    let calculateEnergy = function() {
        let parent = $('.generators-new .tab-pane.active');
        if (parent == undefined) {
            return;
        }

        let res = parent.find('input[name=resolution]:checked').val() + '';
        let enhance = parent.find('select[name=enhance] option:selected').val();
        let iterationsBoost = parent.find('select[name=iterations] option:selected').val();
        let dreamType = parent.find('input[name=dreamType]').val();

        if (iterationsBoost == undefined) {
            iterationsBoost = 1;
        } else {
            iterationsBoost = iterationsBoost / 10;
        }
        if (dreamType == undefined) {
            dreamType = 10;
        }
        dreamType = parseInt(dreamType);

        let resEnergyDs = {
            '0.36': 3,
            '0.6' : 5,
            '1.2' : 12,
            '2.1' : 32,
            '5'   : 80
        }
        let resEnergyTsDD = {
            '0.36': 2,
            '0.6' : 2,
            '1.2' : 4,
            '2.1' : 8,
            '5'   : 20
        }
        let enhanceEnergy = {
            '2x3': 3,
            '5x3': 5
        }

        let resEnergy = resEnergyDs;
        if ([20, 30, 50, 60].includes(dreamType)) {
            resEnergy = resEnergyTsDD;
        }

        let usedByRes = resEnergy[res];
        let usedByEnhance = (enhanceEnergy[enhance] == undefined) ? 0 : enhanceEnergy[enhance];
        let total = (usedByRes * iterationsBoost) + usedByEnhance;
        total = parseInt(Math.round(total));

        parent.find('.calculated-energy').remove();
        parent.find('.generator-submit').before('<span class="calculated-energy">-' + total + ' <i class="energy-icon fa fa-flash"></i></span>');

    }
    calculateEnergy();

    $('.generators-new input[name=resolution]').change(function() {
        calculateEnergy();
    });
    $('.generators-new select[name=enhance]').change(function() {
        calculateEnergy();
    });
    $('.generators-new select[name=iterations]').change(function() {
        calculateEnergy();
    });
    $('.generators-new .nav-tabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        calculateEnergy();
        calculateEnergyText2Dream();
    });

    let calculateEnergyText2Dream = function() {
        let $form = $('#t2d-form');
        let total = 5;

        let quality = $('#t2d-form input[type=radio][name=quality]:checked').val();
        if (quality == 20 /* High quality*/) {
            total = total + 10;
        }

        let upscale = $('#t2d-form input[type=radio][name=aiUpscale]:checked').val();
        if (upscale == 1 /* 2MP */) {
            total = total + 5;
        }
        if (upscale == 2 /* 2MP */) {
            total = total + 10;
        }
        if (upscale == 5 /* 5MP */) {
            total = total + 20;
        }


        let baseRes = $('#drop-baseResolution option:selected').val();
        if (baseRes == 20) {
            total = total + 5;
        }
        if (baseRes == 30) {
            total = total + 10;
        }
        if (baseRes == 40) {
            total = total + 25;
        }

        if ($('#re-generate').length > 0 && quality == 10 /*normal*/ && upscale == 0 /*none*/
            && baseRes <= 10
        ) {
            total = 4;
        }


        total = parseInt(Math.round(total));
        $form.find('.calculated-energy').remove();
        $form.find('.generator-submit').before('<span class="calculated-energy">-' + total + ' <i class="energy-icon fa fa-flash"></i></span>');

    }
    $('#t2d-form input').on('change', function (e) {
        calculateEnergyText2Dream();
    });
    $('#t2d-form select').on('change', function (e) {
        calculateEnergyText2Dream();
    });
    calculateEnergyText2Dream();

    // Generator / 5MP radio button
    $('.radiobuttons#resolution input[type=radio]').change(function() {
        let mp = $(this).val();
        let thisEl = $(this).parents('.generator-settings').find('#enhance');
        if (thisEl.hasClass('ddg-latest')) {
            return;
        }
        if (mp == 5) {
            thisEl.find('option').removeAttr('selected');
            thisEl.addClass('disbaled').attr('disabled', '');
        } else {
            thisEl.removeAttr('disabled').removeClass('disbaled');
        }
    })

});
