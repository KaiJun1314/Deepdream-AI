from woocommerce import API
import re 

wcapi = API(
    url="http://localhost/WordPress/",
    consumer_key="ck_6e8449a35239300dc0734bc72f311f98534d8fec",
    consumer_secret="cs_a13d812a277390c344e57be8b0db5999f9a5ca0e",
    version="wc/v3"
)

def publish_art_api(title, name, description, tags, id, date, phone_number):
    data = {
    'type': 'variable',
    'status': 'draft',
    'attributes': [{
        'name': 'Type',
        'position': 0,
        'visible': True,
        'variation': True,
        'options': ['Digital', 'Printed']}],
    'purchasable': True,
    }
    data["name"] = title
    data['description'] = title + " created by " + name + " by " + date + "\n" + description + "\nPhone Number : " + phone_number
    data["short_description"] = "<a href=\"http://localhost:5000/augmented_reality?image=" + id + ">Visualize It</a>\n"
    data["images"] = [{
        "src": "http://localhost:5000/upload/aiModelImage/result/" + id + ".png",
        "name": title,
        "alt":  title + " Image"}]
    data['tags']= [{"name" : tag} for tag in tags]
    wcapi.post("products", data)
    
def get_index_art():
    data = wcapi.get("products", params = {"per_page": 12}).json()
    item_data_list = []
    for item in data:
        if item["status"] == "publish":
            item_data = dict()
            author = re.findall("(?<=created by\s).*(?=\sby\s)", item["description"])
            item_data["image"] = item["images"][0]["src"]
            item_data["name"] = item["name"]
            item_data["author"] = author[0]
            item_data["url"] = item["permalink"]
            item_data_list.append(item_data)
    return dict(gallery= item_data_list)
