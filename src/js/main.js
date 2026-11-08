var MEAL_API = "https://www.themealdb.com/api/json/v1/1";
var PRODUCT_API = "https://world.openfoodfacts.net";
var FOOD_LOG_KEY = "nutriplan-food-log";

var GOALS = {
    calories: 2000,
    protein: 50,
    carbs: 250,
    fat: 65
};

function escapeHTML(value) {
    if (value === null || value === undefined) {
        value = "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getMealNutrition(meal) {
    var text = (
        (meal.strMeal || "") + " " +
        (meal.strCategory || "") + " " +
        (meal.strArea || "")
    ).toLowerCase();

    var calories = 430;
    var protein = 18;
    var carbs = 36;

    if (text.includes("salad")) {
        calories = 320;
    } else if (text.includes("soup")) {
        calories = 280;
    }

    if (
        text.includes("chicken") ||
        text.includes("beef") ||
        text.includes("fish")
    ) {
        protein = 34;
    }

    if (text.includes("pasta") || text.includes("rice")) {
        carbs = 58;
    }

    var fat = Math.round(
        (calories - protein * 4 - carbs * 4) / 9
    );

    if (fat < 8) {
        fat = 8;
    }

    return {
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat
    };
}

class MealService {

    async request(path) {
        var response = await fetch(MEAL_API + "/" + path);

        if (!response.ok) {
            throw new Error("Recipe service error");
        }

        return await response.json();
    }

    async getInitialMeals() {
        var letters = ["a", "b", "c", "d", "e"];
        var allMeals = [];

        for (var i = 0; i < letters.length; i++) {
            var data = await this.request(
                "search.php?f=" + letters[i]
            );

            if (data.meals) {
                for (var j = 0; j < data.meals.length; j++) {
                    var meal = data.meals[j];
                    var exists = false;

                    for (var k = 0; k < allMeals.length; k++) {
                        if (allMeals[k].idMeal === meal.idMeal) {
                            exists = true;
                            break;
                        }
                    }

                    if (!exists) {
                        allMeals.push(meal);
                    }
                }
            }

            if (allMeals.length >= 25) {
                break;
            }
        }

        return allMeals.slice(0, 25);
    }

    async getLists() {
        var categoriesData = await this.request("categories.php");
        var areasData = await this.request("list.php?a=list");

        var categories = [];
        var areas = [];

        if (categoriesData.categories) {
            for (var i = 0; i < categoriesData.categories.length; i++) {
                categories.push(
                    categoriesData.categories[i].strCategory
                );
            }
        }

        if (areasData.meals) {
            for (var j = 0; j < areasData.meals.length; j++) {
                areas.push(areasData.meals[j].strArea);
            }
        }

        return {
            categories: categories,
            areas: areas
        };
    }

    async getMeal(id) {
        var result = await this.request(
            "lookup.php?i=" + encodeURIComponent(id)
        );

        if (result.meals && result.meals.length > 0) {
            return result.meals[0];
        }

        return null;
    }

    async search(query) {
        var result = await this.request(
            "search.php?s=" + encodeURIComponent(query)
        );

        return result.meals || [];
    }

    async filter(type, value) {
        var parameter = "c";

        if (type === "area") {
            parameter = "a";
        }

        var result = await this.request(
            "filter.php?" + parameter + "=" + encodeURIComponent(value)
        );

        var meals = result.meals || [];
        var fullMeals = [];

        for (var i = 0; i < meals.length && i < 25; i++) {
            var meal = await this.getMeal(meals[i].idMeal);

            if (meal) {
                fullMeals.push(meal);
            }
        }

        return fullMeals;
    }
}

class ProductService {

    async search(query, searchType) {
        if (!searchType) {
            searchType = "brand";
        }

        var tag = query.trim().toLowerCase();
        tag = tag.replace(/[\s_]+/g, "-");

        var filterName = "brands_tags";
        var filterValue = tag;

        if (searchType === "category") {
            filterName = "categories_tags";
            filterValue = "en:" + tag;
        }

        var url = PRODUCT_API + "/api/v2/search";
        url += "?" + filterName + "=" + encodeURIComponent(filterValue);
        url += "&page_size=12";
        url += "&fields=code,product_name,brands,nutrition_grades,nutriments,quantity,image_front_url";

        var response = await fetch(url);

        if (!response.ok) {
            throw new Error("Product service error");
        }

        var result = await response.json();

        return result.products || [];
    }

    async barcode(code) {
        var url = PRODUCT_API + "/api/v2/product/";
        url += encodeURIComponent(code) + ".json";

        var response = await fetch(url);

        if (!response.ok) {
            throw new Error("Barcode service error");
        }

        var result = await response.json();

        if (result.status === 1 && result.product) {
            return [result.product];
        }

        return [];
    }
}

class FoodLog {

    read() {
        try {
            var saved = localStorage.getItem(FOOD_LOG_KEY);

            if (!saved) {
                return {};
            }

            var data = JSON.parse(saved);

            if (typeof data === "object" && data !== null && !Array.isArray(data)) {
                return data;
            }

            return {};

        } catch (error) {
            console.log(error);
            return {};
        }
    }

    save(data) {
        try {
            localStorage.setItem(
                FOOD_LOG_KEY,
                JSON.stringify(data)
            );
        } catch (error) {
            console.log(error);
            throw new Error("Could not save your food log.");
        }
    }

    add(item, date) {
        if (!date) {
            date = this.today();
        }

        var data = this.read();

        if (!data[date]) {
            data[date] = [];
        }

        var newItem = {
            type: item.type,
            name: item.name,
            image: item.image,
            nutrition: item.nutrition,
            logId: Date.now() + "-" + Math.random()
        };

        data[date].push(newItem);

        this.save(data);
    }

    remove(logId, date) {
        if (!date) {
            date = this.today();
        }

        var data = this.read();
        var items = data[date] || [];
        var newItems = [];

        for (var i = 0; i < items.length; i++) {
            if (items[i].logId !== logId) {
                newItems.push(items[i]);
            }
        }

        data[date] = newItems;

        this.save(data);
    }

    clear(date) {
        if (!date) {
            date = this.today();
        }

        var data = this.read();

        delete data[date];

        this.save(data);
    }

    today() {
        var now = new Date();

        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, "0");
        var day = String(now.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }
}

class NutriPlanApp {

    constructor() {
        this.mealService = new MealService();
        this.productService = new ProductService();
        this.foodLog = new FoodLog();

        this.meals = [];
        this.categories = [];
        this.areas = [];

        this.activeFilter = {
            type: "all",
            value: ""
        };

        this.productResults = [];
        this.productGrade = "";
        this.view = "grid";
        this.displayedMeals = [];
        this.searchRequest = 0;
        this.productRequest = 0;
        this.currentMeal = null;
        this.selectedLogDate = "";
    }

    async init() {
        this.cacheElements();
        this.prepareStaticControls();
        this.bindEvents();
        this.routeFromLocation();

        try {
            var meals = await this.mealService.getInitialMeals();
            var lists = await this.mealService.getLists();

            this.meals = meals;
            this.categories = lists.categories;
            this.areas = lists.areas;

            this.renderCategoryFilters();
            this.renderMeals(meals);

            if (this.currentView() === "details") {
                await this.openMeal(this.currentMealId(), false);
            }

        } catch (error) {
            console.log(error);

            this.showMessage(
                this.elements.recipesGrid,
                "We couldn't load recipes. Check your connection and try again.",
                true
            );

            this.elements.recipesCount.textContent = "Recipes unavailable";

        } finally {
            if (this.elements.loading) {
                this.elements.loading.classList.add("is-hidden");
            }
        }
    }

    cacheElements() {
        this.elements = {
            loading: document.querySelector("#app-loading-overlay"),
            headerTitle: document.querySelector("#header h1"),
            headerDescription: document.querySelector("#header p"),
            navLinks: document.querySelectorAll(".nav-link"),
            searchFilters: document.querySelector("#search-filters-section"),
            categoriesSection: document.querySelector("#meal-categories-section"),
            recipesSection: document.querySelector("#all-recipes-section"),
            categoriesGrid: document.querySelector("#categories-grid"),
            recipesGrid: document.querySelector("#recipes-grid"),
            recipesCount: document.querySelector("#recipes-count"),
            searchInput: document.querySelector("#search-input"),
            details: document.querySelector("#meal-details"),
            products: document.querySelector("#products-section"),
            foodlog: document.querySelector("#foodlog-section"),
            productsGrid: document.querySelector("#products-grid"),
            productsCount: document.querySelector("#products-count"),
            productSearch: document.querySelector("#product-search-input"),
            barcode: document.querySelector("#barcode-input")
        };
    }

    prepareStaticControls() {
        var chips = this.elements.searchFilters.querySelector(".overflow-x-auto");

        chips.innerHTML = `
            <button class="meal-filter-chip is-active" data-filter-type="all">
                All Cuisines
            </button>
        `;

        this.elements.recipesGrid.classList.remove("grid-cols-4");
        this.elements.categoriesGrid.innerHTML = "";
        this.elements.productsGrid.innerHTML = "";
    }

    bindEvents() {
        document.querySelector("#header-menu-btn").addEventListener("click", function() {
            document.body.classList.toggle("sidebar-open");
        });

        document.querySelector("#sidebar-close-btn").addEventListener("click", function() {
            document.body.classList.remove("sidebar-open");
        });

        document.querySelector("#sidebar-overlay").addEventListener("click", function() {
            document.body.classList.remove("sidebar-open");
        });

        var links = this.elements.navLinks;
        var routes = ["home", "products", "foodlog"];

        for (var i = 0; i < links.length; i++) {
            links[i].href = routes[i];

            links[i].addEventListener("click", (event) => {
                event.preventDefault();

                document.body.classList.remove("sidebar-open");

                var index = Array.prototype.indexOf.call(links, event.currentTarget);

                this.navigate(routes[index]);
            });
        }

        this.elements.searchInput.addEventListener("input", () => {
            this.searchMeals();
        });

        this.elements.searchFilters.addEventListener("click", (event) => {
            var filter = event.target.closest("[data-filter-type]");

            if (!filter) {
                return;
            }

            this.filterMeals(
                filter.dataset.filterType,
                filter.dataset.filterValue || ""
            );
        });

        this.elements.categoriesGrid.addEventListener("click", (event) => {
            var card = event.target.closest("[data-category]");

            if (card) {
                this.filterMeals("category", card.dataset.category);
            }
        });

        this.elements.recipesGrid.addEventListener("click", (event) => {
            var card = event.target.closest("[data-meal-id]");

            if (card) {
                this.openMeal(card.dataset.mealId);
            }
        });

        this.elements.details.addEventListener("click", (event) => {
            if (event.target.closest("#back-to-meals-btn")) {
                this.navigate("home");
            }

            if (event.target.closest("#log-meal-btn") && this.currentMeal) {
                this.logMeal(this.currentMeal);
            }
        });

        document.querySelector("#grid-view-btn").addEventListener("click", () => {
            this.setView("grid");
        });

        document.querySelector("#list-view-btn").addEventListener("click", () => {
            this.setView("list");
        });

        document.querySelector("#search-product-btn").addEventListener("click", () => {
            this.searchProducts();
        });

        document.querySelector("#lookup-barcode-btn").addEventListener("click", () => {
            this.lookupBarcode();
        });

        this.elements.productSearch.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                this.searchProducts();
            }
        });

        this.elements.barcode.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                this.lookupBarcode();
            }
        });

        this.elements.products.addEventListener("click", (event) => {
            var grade = event.target.closest(".nutri-score-filter");

            if (grade) {
                this.productGrade = grade.dataset.grade;
                this.updateProductGradeButtons();
                this.renderProducts();
            }

            var category = event.target.closest(".product-category-btn");

            if (category) {
                this.elements.productSearch.value = category.textContent.trim();
                this.searchProducts("category");
            }

            var logButton = event.target.closest("[data-product-index]");

            if (logButton) {
                var index = Number(logButton.dataset.productIndex);
                this.logProduct(this.productResults[index]);
            }
        });

        this.elements.foodlog.addEventListener("click", (event) => {
            var removeButton = event.target.closest("[data-remove-log]");

            if (removeButton) {
                var date = this.selectedLogDate || this.foodLog.today();

                this.foodLog.remove(
                    removeButton.dataset.removeLog,
                    date
                );

                this.renderFoodLog();
            }

            if (event.target.closest("#clear-foodlog")) {
                var date = this.selectedLogDate || this.foodLog.today();

                this.foodLog.clear(date);
                this.renderFoodLog();
            }

            var actionButton = event.target.closest("[data-log-action]");

            if (actionButton) {
                if (actionButton.dataset.logAction === "meal") {
                    this.navigate("home");
                } else {
                    this.navigate("products");
                }
            }
        });

        window.addEventListener("popstate", () => {
            this.routeFromLocation();
        });
    }

    currentView() {
        var path = (
            location.pathname + location.hash
        ).toLowerCase();

        if (path.includes("foodlog")) {
            return "foodlog";
        }

        if (path.includes("product")) {
            return "products";
        }

        if (path.includes("/meal/") || path.includes("#/meal/")) {
            return "details";
        }

        return "home";
    }

    currentMealId() {
        var path = location.pathname + location.hash;
        var result = path.match(/meal\/([^/?#]+)/i);

        if (result) {
            return result[1];
        }

        return null;
    }

    routeFromLocation() {
        var view = this.currentView();

        if (view === "details") {
            this.showPage("details");

            var id = this.currentMealId();

            if (id && this.meals.length > 0) {
                this.openMeal(id, false);
            }

        } else {
            this.showPage(view);

            if (view === "home" && this.meals.length > 0) {
                this.renderMeals(this.meals);
            }
        }
    }

    navigate(route) {
        var path = route;

        if (route === "details" && this.currentMeal) {
            path = "meal/" + encodeURIComponent(this.currentMeal.idMeal);
        }

        var basePath = location.pathname;

        basePath = basePath.replace(
            /(?:home|foodlog|products|meal\/[^/]+)\/?$/i,
            ""
        );

        basePath = basePath.replace(/index\.html$/i, "");
        basePath = basePath.replace(/\/$/, "");

        var nextURL = basePath + "/" + path;

        try {
            history.pushState({ route: path }, "", nextURL);
        } catch (error) {
            history.pushState({ route: path }, "", "#/" + path);
        }

        this.showPage(route);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    showPage(view) {
        var isHome = view === "home";

        this.elements.searchFilters.hidden = !isHome;
        this.elements.categoriesSection.hidden = !isHome;
        this.elements.recipesSection.hidden = !isHome;

        this.elements.details.hidden = view !== "details";
        this.elements.products.hidden = view !== "products";
        this.elements.foodlog.hidden = view !== "foodlog";

        var titles = {
            home: [
                "Meals & Recipes",
                "Discover delicious and nutritious recipes tailored for you"
            ],
            products: [
                "Product Scanner",
                "Find nutrition information for packaged foods"
            ],
            foodlog: [
                "Food Log",
                "Track and monitor your daily nutrition intake"
            ],
            details: [
                "Meal Details",
                "Ingredients, instructions and nutrition facts"
            ]
        };

        this.elements.headerTitle.textContent = titles[view][0];
        this.elements.headerDescription.textContent = titles[view][1];

        var routes = ["home", "products", "foodlog"];

        for (var i = 0; i < this.elements.navLinks.length; i++) {
            var active = routes[i] === view;
            var link = this.elements.navLinks[i];

            link.classList.toggle("is-current", active);
            link.classList.toggle("bg-emerald-50", active);
            link.classList.toggle("text-emerald-700", active);
        }

        if (view === "foodlog") {
            this.renderFoodLog();
        }
    }

    renderCategoryFilters() {
        var areaFilters = this.elements.searchFilters.querySelector(".overflow-x-auto");

        var html = `
            <button class="meal-filter-chip is-active" data-filter-type="all">
                All Cuisines
            </button>
        `;

        for (var i = 0; i < this.areas.length; i++) {
            var area = this.areas[i];

            html += `
                <button class="meal-filter-chip"
                    data-filter-type="area"
                    data-filter-value="${escapeHTML(area)}">
                    ${escapeHTML(area)}
                </button>
            `;
        }

        areaFilters.innerHTML = html;

        var categoryIcons = {
            beef: "fa-drumstick-bite",
            chicken: "fa-drumstick-bite",
            dessert: "fa-cake-candles",
            lamb: "fa-drumstick-bite",
            miscellaneous: "fa-bowl-food",
            pasta: "fa-bowl-food",
            pork: "fa-bacon",
            seafood: "fa-fish",
            side: "fa-bowl-rice",
            starter: "fa-utensils",
            vegan: "fa-leaf",
            vegetarian: "fa-seedling"
        };

        html = "";

        for (var j = 0; j < this.categories.length && j < 12; j++) {
            var category = this.categories[j];
            var icon = categoryIcons[category.toLowerCase()] || "fa-utensils";

            html += `
                <button class="category-card category-tone-${j % 12}"
                    data-category="${escapeHTML(category)}">
                    <span class="category-icon">
                        <i class="fa-solid ${icon}" aria-hidden="true"></i>
                    </span>
                    <span>
                        <strong>${escapeHTML(category)}</strong>
                        <small>Explore recipes</small>
                    </span>
                </button>
            `;
        }

        this.elements.categoriesGrid.innerHTML = html;
    }

    async searchMeals() {
        var query = this.elements.searchInput.value.trim();

        this.activeFilter = {
            type: "search",
            value: query
        };

        this.searchRequest++;

        var requestId = this.searchRequest;

        if (query === "") {
            this.renderMeals(this.meals);
            return;
        }

        this.showMessage(
            this.elements.recipesGrid,
            "Searching recipes..."
        );

        try {
            var results = await this.mealService.search(query);

            if (requestId !== this.searchRequest) {
                return;
            }

            this.renderMeals(results);

        } catch (error) {
            if (requestId !== this.searchRequest) {
                return;
            }

            console.log(error);

            this.showMessage(
                this.elements.recipesGrid,
                "Search is unavailable. Please try again.",
                true
            );
        }
    }

    async filterMeals(type, value) {
        this.searchRequest++;

        var requestId = this.searchRequest;

        this.activeFilter = {
            type: type,
            value: value
        };

        this.elements.searchInput.value = "";

        var chips = this.elements.searchFilters.querySelectorAll(
            ".meal-filter-chip"
        );

        for (var i = 0; i < chips.length; i++) {
            var active = chips[i].dataset.filterType === type;

            if (type === "area") {
                active = active && chips[i].dataset.filterValue === value;
            }

            chips[i].classList.toggle("is-active", active);
        }

        if (type === "all") {
            this.renderMeals(this.meals);
            return;
        }

        this.showMessage(
            this.elements.recipesGrid,
            "Finding recipes..."
        );

        try {
            var results = await this.mealService.filter(type, value);

            if (requestId !== this.searchRequest) {
                return;
            }

            this.renderMeals(results);

        } catch (error) {
            if (requestId !== this.searchRequest) {
                return;
            }

            console.log(error);

            this.showMessage(
                this.elements.recipesGrid,
                "Could not load recipes for this filter. Please try again.",
                true
            );
        }
    }

    renderMeals(meals) {
        var safeMeals = [];

        if (meals) {
            for (var i = 0; i < meals.length; i++) {
                if (meals[i]) {
                    safeMeals.push(meals[i]);
                }
            }
        }

        this.displayedMeals = safeMeals;

        var count = safeMeals.length;
        var word = count === 1 ? "recipe" : "recipes";

        this.elements.recipesCount.textContent =
            "Showing " + count + " " + word;

        if (count === 0) {
            this.showMessage(
                this.elements.recipesGrid,
                "No recipes found. Try another search or filter."
            );

            return;
        }

        this.elements.recipesGrid.classList.toggle(
            "is-list-view",
            this.view === "list"
        );

        var html = "";

        for (var j = 0; j < safeMeals.length; j++) {
            var meal = safeMeals[j];

            html += `
                <article class="recipe-card"
                    data-meal-id="${escapeHTML(meal.idMeal)}"
                    tabindex="0"
                    role="button"
                    aria-label="View ${escapeHTML(meal.strMeal)}">

                    <div class="recipe-image-wrap">
                        <img
                            src="${escapeHTML(meal.strMealThumb || "")}"
                            alt="${escapeHTML(meal.strMeal)}"
                            loading="lazy">

                        <div class="recipe-badges">
                            <span>${escapeHTML(meal.strCategory || "Meal")}</span>
                            <span>${escapeHTML(meal.strArea || "Cuisine")}</span>
                        </div>
                    </div>

                    <div class="recipe-copy">
                        <h3>${escapeHTML(meal.strMeal)}</h3>

                        <p>
                            ${escapeHTML(meal.strInstructions || "A delicious recipe to try.")}
                        </p>

                        <div class="recipe-meta">
                            <span>🍽 ${escapeHTML(meal.strCategory || "Recipe")}</span>
                            <span>🌍 ${escapeHTML(meal.strArea || "Global")}</span>
                        </div>
                    </div>
                </article>
            `;
        }

        this.elements.recipesGrid.innerHTML = html;

        var cards = this.elements.recipesGrid.querySelectorAll(".recipe-card");

        for (var k = 0; k < cards.length; k++) {
            cards[k].addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();

                    this.openMeal(event.currentTarget.dataset.mealId);
                }
            });
        }
    }

    async openMeal(id, updateRoute) {
        if (updateRoute === undefined) {
            updateRoute = true;
        }

        var meal = null;

        for (var i = 0; i < this.meals.length; i++) {
            if (this.meals[i].idMeal === id) {
                meal = this.meals[i];
                break;
            }
        }

        try {
            var fullMeal = await this.mealService.getMeal(id);

            if (fullMeal) {
                meal = fullMeal;
            }

        } catch (error) {
            console.log(error);

            if (!meal) {
                this.showMessage(
                    this.elements.details,
                    "Meal details are unavailable. Please try again.",
                    true
                );

                return;
            }
        }

        if (!meal) {
            return;
        }

        this.currentMeal = meal;

        if (updateRoute) {
            this.navigate("details");
        }

        this.renderMealDetails(meal);
        this.showPage("details");
    }

    renderMealDetails(meal) {
        var ingredients = [];

        for (var i = 1; i <= 20; i++) {
            var ingredient = meal["strIngredient" + i] || "";
            var measure = meal["strMeasure" + i] || "";

            ingredient = ingredient.trim();
            measure = measure.trim();

            if (ingredient !== "") {
                ingredients.push({
                    ingredient: ingredient,
                    measure: measure
                });
            }
        }

        var instructions = (meal.strInstructions || "").split(/\r?\n/);
        var instructionsHTML = "";

        for (var j = 0; j < instructions.length; j++) {
            var line = instructions[j].trim();

            if (line !== "") {
                instructionsHTML += "<li>" + escapeHTML(line) + "</li>";
            }
        }

        var ingredientsHTML = "";

        for (var k = 0; k < ingredients.length; k++) {
            ingredientsHTML += `
                <label>
                    <input type="checkbox">
                    <span>
                        <strong>${escapeHTML(ingredients[k].measure)}</strong>
                        ${escapeHTML(ingredients[k].ingredient)}
                    </span>
                </label>
            `;
        }

        var nutrition = getMealNutrition(meal);
        var videoHTML = "";

        if (meal.strYoutube) {
            var videoURL = meal.strYoutube
                .replace("watch?v=", "embed/")
                .split("&")[0];

            videoHTML = `
                <section class="detail-card">
                    <h2>Video Tutorial</h2>

                    <div class="video-frame">
                        <iframe
                            src="${escapeHTML(videoURL)}"
                            title="How to prepare ${escapeHTML(meal.strMeal)}"
                            allowfullscreen
                            loading="lazy">
                        </iframe>
                    </div>
                </section>
            `;
        }

        this.elements.details.innerHTML = `
            <div class="meal-detail-content">

                <button id="back-to-meals-btn" class="back-button">
                    ← Back to Recipes
                </button>

                <div class="detail-hero"
                    style="--meal-image:url('${escapeHTML(meal.strMealThumb || "")}')">

                    <div>
                        <span class="detail-tag">
                            ${escapeHTML(meal.strCategory || "Recipe")}
                        </span>

                        <span class="detail-tag">
                            ${escapeHTML(meal.strArea || "Cuisine")}
                        </span>

                        <h1>${escapeHTML(meal.strMeal)}</h1>

                        <p>
                            🍽 ${escapeHTML(meal.strCategory || "Meal")}
                            &nbsp; · &nbsp;
                            🌍 ${escapeHTML(meal.strArea || "Global")}
                        </p>
                    </div>
                </div>

                <button id="log-meal-btn" class="primary-action">
                    ＋ Log This Meal
                </button>

                <div class="detail-columns">

                    <div class="detail-main">

                        <section class="detail-card">
                            <h2>
                                Ingredients
                                <small>${ingredients.length} items</small>
                            </h2>

                            <div class="ingredient-list">
                                ${ingredientsHTML}
                            </div>
                        </section>

                        <section class="detail-card">
                            <h2>Instructions</h2>

                            <ol class="instruction-list">
                                ${instructionsHTML}
                            </ol>
                        </section>

                        ${videoHTML}

                    </div>

                    <aside class="detail-card nutrition-card">

                        <h2>Nutrition Facts</h2>

                        <p class="nutrition-note">
                            Estimated values per serving
                        </p>

                        <div class="calories-highlight">
                            <span>Calories per serving</span>
                            <strong>${nutrition.calories}</strong>
                            <small>kcal</small>
                        </div>

                        ${this.nutritionRows(nutrition)}

                        <p class="nutrition-disclaimer">
                            Nutrition is an estimate; TheMealDB does not provide verified nutrition data.
                        </p>

                    </aside>

                </div>
            </div>
        `;
    }

    nutritionRows(nutrition) {
        var html = "";

        html += `
            <div class="nutrition-row">
                <span>Protein</span>
                <strong>${nutrition.protein}g</strong>
            </div>
        `;

        html += `
            <div class="nutrition-row">
                <span>Carbohydrates</span>
                <strong>${nutrition.carbs}g</strong>
            </div>
        `;

        html += `
            <div class="nutrition-row">
                <span>Fat</span>
                <strong>${nutrition.fat}g</strong>
            </div>
        `;

        return html;
    }

    async searchProducts(searchType) {
        if (!searchType) {
            searchType = "brand";
        }

        var query = this.elements.productSearch.value.trim();

        this.productRequest++;

        var requestId = this.productRequest;

        if (query === "") {
            this.showMessage(
                this.elements.productsGrid,
                "Enter a product name to search."
            );

            return;
        }

        this.showMessage(
            this.elements.productsGrid,
            "Searching products..."
        );

        try {
            var results = await this.productService.search(query, searchType);

            if (requestId !== this.productRequest) {
                return;
            }

            this.productResults = results;
            this.renderProducts();

        } catch (error) {
            if (requestId !== this.productRequest) {
                return;
            }

            console.log(error);

            this.showMessage(
                this.elements.productsGrid,
                "Product search is unavailable. Please try again.",
                true
            );
        }
    }

    async lookupBarcode() {
        var barcode = this.elements.barcode.value.trim();

        this.productRequest++;

        var requestId = this.productRequest;

        if (barcode === "") {
            this.showMessage(
                this.elements.productsGrid,
                "Enter a barcode number to look up."
            );

            return;
        }

        this.showMessage(
            this.elements.productsGrid,
            "Looking up barcode..."
        );

        try {
            var results = await this.productService.barcode(barcode);

            if (requestId !== this.productRequest) {
                return;
            }

            this.productResults = results;
            this.renderProducts();

        } catch (error) {
            if (requestId !== this.productRequest) {
                return;
            }

            console.log(error);

            this.showMessage(
                this.elements.productsGrid,
                "Barcode lookup is unavailable. Please try again.",
                true
            );
        }
    }

    renderProducts() {
        var results = [];

        for (var i = 0; i < this.productResults.length; i++) {
            var product = this.productResults[i];
            var grade = (product.nutrition_grades || "").toLowerCase();

            if (this.productGrade === "" || grade === this.productGrade) {
                results.push({
                    product: product,
                    index: i
                });
            }
        }

        var count = results.length;
        var word = count === 1 ? "product" : "products";

        this.elements.productsCount.textContent =
            count + " " + word + " found";

        if (count === 0) {
            this.showMessage(
                this.elements.productsGrid,
                "No matching products found."
            );

            return;
        }

        var html = "";

        for (var j = 0; j < results.length; j++) {
            var product = results[j].product;
            var index = results[j].index;

            var nutrition = product.nutriments || {};

            var calories = Number(nutrition["energy-kcal_100g"] || 0);
            var protein = Number(nutrition.proteins_100g || 0);
            var carbs = Number(nutrition.carbohydrates_100g || 0);
            var fat = Number(nutrition.fat_100g || 0);
            var sugar = Number(nutrition.sugars_100g || 0);

            var imageHTML = "";

            if (product.image_front_url) {
                imageHTML = `
                    <img
                        src="${escapeHTML(product.image_front_url)}"
                        alt="${escapeHTML(product.product_name || "Food product")}"
                        loading="lazy">
                `;
            } else {
                imageHTML = `
                    <div class="product-image-placeholder">
                        📦
                    </div>
                `;
            }

            html += `
                <article class="product-card">

                    ${imageHTML}

                    <div class="product-card-body">

                        <p class="product-brand">
                            ${escapeHTML(product.brands || "Food product")}
                        </p>

                        <h3>
                            ${escapeHTML(product.product_name || "Unnamed product")}
                        </h3>

                        <p class="product-meta">
                            ${escapeHTML(product.quantity || "Per 100 g")}
                            · ${Math.round(calories)} kcal/100g
                            · Nutri-Score ${(product.nutrition_grades || "n/a").toUpperCase()}
                        </p>

                        <div class="product-nutrition">
                            <span>Protein <b>${protein}g</b></span>
                            <span>Carbs <b>${carbs}g</b></span>
                            <span>Fat <b>${fat}g</b></span>
                            <span>Sugar <b>${sugar}g</b></span>
                        </div>

                        <button class="primary-action"
                            data-product-index="${index}">
                            ＋ Add to Food Log
                        </button>

                    </div>
                </article>
            `;
        }

        this.elements.productsGrid.innerHTML = html;
    }

    updateProductGradeButtons() {
        var buttons = this.elements.products.querySelectorAll(
            ".nutri-score-filter"
        );

        for (var i = 0; i < buttons.length; i++) {
            var active = buttons[i].dataset.grade === this.productGrade;

            buttons[i].classList.toggle("grade-active", active);
        }
    }

    logMeal(meal) {
        var nutrition = getMealNutrition(meal);

        try {
            this.foodLog.add({
                type: "meal",
                name: meal.strMeal,
                image: meal.strMealThumb,
                nutrition: nutrition
            });

            this.notify(
                meal.strMeal + " added to today's food log."
            );

        } catch (error) {
            this.notify(error.message, true);
        }
    }

    logProduct(product) {
        if (!product) {
            return;
        }

        var nutrients = product.nutriments || {};

        var nutrition = {
            calories: Math.round(Number(nutrients["energy-kcal_100g"] || 0)),
            protein: Number(nutrients.proteins_100g || 0),
            carbs: Number(nutrients.carbohydrates_100g || 0),
            fat: Number(nutrients.fat_100g || 0)
        };

        try {
            this.foodLog.add({
                type: "product",
                name: product.product_name || "Food product",
                image: product.image_front_url || "",
                nutrition: nutrition
            });

            this.notify(
                (product.product_name || "Product") +
                " added to today's food log."
            );

        } catch (error) {
            this.notify(error.message, true);
        }
    }

    renderFoodLog() {
        var date = this.selectedLogDate || this.foodLog.today();

        var data = this.foodLog.read();
        var items = data[date] || [];

        var totals = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };

        for (var i = 0; i < items.length; i++) {
            var nutrition = items[i].nutrition || {};

            totals.calories += Number(nutrition.calories || 0);
            totals.protein += Number(nutrition.protein || 0);
            totals.carbs += Number(nutrition.carbs || 0);
            totals.fat += Number(nutrition.fat || 0);
        }

        var itemsHTML = "";

        if (items.length > 0) {
            for (var j = 0; j < items.length; j++) {
                itemsHTML += this.loggedItem(items[j], date);
            }
        } else {
            itemsHTML = `
                <div class="empty-log">
                    <span>🍽</span>
                    <strong>No meals logged for this day</strong>
                    <p>Add meals from recipes or products from the scanner.</p>
                </div>
            `;
        }

        var clearButton = "";

        if (items.length > 0) {
            clearButton = `
                <button id="clear-foodlog">Clear All</button>
            `;
        }

        this.elements.foodlog.innerHTML = `
            <div class="foodlog-content">

                <div class="foodlog-hero">

                    <div>
                        <h2>Daily Food Log</h2>
                        <p>Track and monitor your daily nutrition intake</p>
                    </div>

                    <label>
                        Day
                        <input
                            type="date"
                            id="foodlog-date-input"
                            value="${date}"
                            max="${this.foodLog.today()}">
                    </label>

                </div>

                <section class="foodlog-panel">

                    <h3>Today's Nutrition</h3>

                    <div class="nutrition-goals">

                        ${this.goalCard("Calories", totals.calories, GOALS.calories, "kcal", "green")}

                        ${this.goalCard("Protein", totals.protein, GOALS.protein, "g", "blue")}

                        ${this.goalCard("Carbs", totals.carbs, GOALS.carbs, "g", "amber")}

                        ${this.goalCard("Fat", totals.fat, GOALS.fat, "g", "purple")}

                    </div>

                    <div class="logged-heading">
                        <h4>Logged Items (${items.length})</h4>
                        ${clearButton}
                    </div>

                    <div id="logged-items-list">
                        ${itemsHTML}
                    </div>

                </section>

                <section class="foodlog-panel">

                    <h3>Quick Actions</h3>

                    <div class="quick-actions">

                        <button data-log-action="meal">
                            ＋
                            <span>
                                Log a Meal
                                <small>Add from recipes</small>
                            </span>
                        </button>

                        <button data-log-action="products">
                            ▦
                            <span>
                                Scan Product
                                <small>Search a packaged food</small>
                            </span>
                        </button>

                    </div>

                </section>

            </div>
        `;

        document.querySelector("#foodlog-date-input").addEventListener(
            "change",
            (event) => {
                this.selectedLogDate = event.target.value || this.foodLog.today();
                this.renderFoodLog();
            }
        );
    }

    goalCard(label, value, goal, unit, color) {
        var percentage = Math.round((value / goal) * 100);

        if (percentage > 100) {
            percentage = 100;
        }

        return `
            <div class="goal-card ${color}">

                <div>
                    <strong>${label}</strong>
                    <span>
                        ${Math.round(value)} / ${goal} ${unit}
                    </span>
                </div>

                <div class="goal-track">
                    <i style="width:${percentage}%"></i>
                </div>

            </div>
        `;
    }

    loggedItem(item, date) {
        var nutrition = item.nutrition || {};

        var imageHTML = "";

        if (item.image) {
            imageHTML = `
                <img src="${escapeHTML(item.image)}" alt="">
            `;
        } else {
            imageHTML = `
                <span class="logged-icon">🍽</span>
            `;
        }

        var type = "Meal";

        if (item.type === "product") {
            type = "Product";
        }

        return `
            <article class="logged-item">

                ${imageHTML}

                <div class="logged-item-main">

                    <strong>${escapeHTML(item.name)}</strong>

                    <small>
                        ${type}
                        · ${Math.round(nutrition.calories || 0)} kcal
                        · ${Math.round(nutrition.protein || 0)}g protein
                    </small>

                </div>

                <button
                    aria-label="Remove ${escapeHTML(item.name)}"
                    data-remove-log="${escapeHTML(item.logId)}"
                    data-date="${date}">
                    Remove
                </button>

            </article>
        `;
    }

    setView(view) {
        this.view = view;

        this.renderMeals(this.displayedMeals);

        document.querySelector("#grid-view-btn").classList.toggle(
            "view-active",
            view === "grid"
        );

        document.querySelector("#list-view-btn").classList.toggle(
            "view-active",
            view === "list"
        );
    }

    showMessage(container, message, isError) {
        if (isError === undefined) {
            isError = false;
        }

        var className = "app-message";

        if (isError) {
            className += " is-error";
        }

        container.innerHTML = `
            <div class="${className}">
                ${escapeHTML(message)}
            </div>
        `;
    }

    notify(message, isError) {
        if (isError === undefined) {
            isError = false;
        }

        var oldToast = document.querySelector(".app-toast");

        if (oldToast) {
            oldToast.remove();
        }

        var toast = document.createElement("div");

        toast.className = "app-toast";

        if (isError) {
            toast.classList.add("is-error");
        }

        toast.textContent = message;

        document.body.append(toast);

        setTimeout(function() {
            toast.remove();
        }, 3500);
    }
}

var app = new NutriPlanApp();

app.init();