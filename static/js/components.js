const domain = window.location.protocol + '//' + document.domain + ':' + location.port ;

//  Members data to be inserted.
let membersDOM = "";
// current teams
const getGallery = async() => {
    document.getElementById("gallery-dev").innerHTML = `<h1 style="margin:90px auto">Loading Gallery ....</h1>`;
    let data = await (await fetch(`${domain}/get_gallery`)).json();
    if (data.gallery.length == 0) {
        membersDOM = `<h1 style="margin:90px auto">No Gallery Found</h1>`
    } else {
        for (let i = 0; i < data.gallery.length; i++) {
            let card = `<div class="col-xl-3 col-lg-4 col-md-6 mb-4">
        <div class="bg-white rounded shadow-sm"><a href="${data.gallery[i].image}"
            data-lightbox="photos"><img src="${data.gallery[i].image}" alt="" class="img-fluid card-img-top">
          <div class="p-4">
            <h5> <a href="${data.gallery[i].url}" class="text-dark">${data.gallery[i].name}</a></h5>
            <p class="small text-muted mb-0">Create By: ${data.gallery[i].author}</p>
            </div>
          </div>
        </div>
      </div>`
            membersDOM += card;
        } 
    }
    document.getElementById("gallery-dev").innerHTML = membersDOM;
}
getGallery()