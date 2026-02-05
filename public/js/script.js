// handle submissions--starts------

function formDataToObject(formData) {
  const obj = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

// Generic function to handle form submissions
const handleFormSubmit = async (event, url) => {
  event.preventDefault();

  const formData = new FormData(event.target);
  const clickedButtonValue = event.submitter?.value || "";
  formData.append("submit", clickedButtonValue);

  const formDataObj = formDataToObject(formData);
  console.log("Submitting to URL:", url, "with data:", formDataObj);

  // Confirm first
  const confirmationResult = await Swal.fire({
    title: "Confirm Submission",
    text: "Are you sure you want proceed?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes!",
    cancelButtonText: "No!",
  });

  if (!confirmationResult.isConfirmed) return;

  const loader = document.getElementById("loader0");
  if (loader) loader.style.display = "block";

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "follow",
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error("Server returned HTML instead of JSON (route/redirect/error)");
    }

    if (loader) loader.style.display = "none";
    console.log("Response data:", data);

    if (data && data.title) {
      const result = await Swal.fire({
        title: data.title,
        text: data.message,
        confirmButtonText: "OK",
        icon: data.icon || "info",
      });

      if (result.isConfirmed && data.redirect) {
        window.location.href = data.redirect;
      }
    } else {
      throw new Error("Unexpected response format");
    }

  } catch (error) {
    if (loader) loader.style.display = "none";
    console.error("Fetch error:", error);

    Swal.fire({
      title: "Error",
      text: error.message || "Request failed",
      icon: "error",
    });
  }
};

// Attach event listeners to each form, passing the appropriate endpoint URL
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/user/login");
    });
  }

  const adminLoginForm = document.getElementById("adminLoginForm");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/admin");
    });
  }

  const backbtn = document.getElementById("backbtn");
  if (backbtn) {
    backbtn.addEventListener("click", function (e) {
      e.preventDefault();
      window.history.back();
    });
  }


  loaderHideFunc();
});
// handle submissions--ends------

// home page loader start
const loader = document.getElementById("loader");
function loaderHideFunc() {
  loader.style.display = "none";
}
// home page loader stop

// ---------------------------------------------------------------------------

// User logout
// Attach event listeners to each form, passing the appropriate endpoint URL

async function handleUserogout(event, url) {
  event.preventDefault(); // Prevent the default form submission

  // First, show confirmation before submitting the data
  const confirmationResult = await Swal.fire({
    title: "Confirm Submission",
    text: "Are you sure you want proceed?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes!",
    cancelButtonText: "No!",
  });

  if (!confirmationResult.isConfirmed) {
    // If the user cancels, exit the function
    return;
  }

  fetch(url, {
    // Send the FormData object to the specified route
    method: "POST",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      if (data) {
        Swal.fire({
          title: data.title,
          text: data.message,
          confirmButtonText: "OK",

          icon: data.icon,
        }).then((result) => {
          /* Read more about isConfirmed, isDenied below */
          if (result.isConfirmed) {
            window.location.reload();
          }
        });
      } // Handle the response data
    })
    .catch((error) => {
      console.error("Error:", error); // Handle any errors
    });
}
